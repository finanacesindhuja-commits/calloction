const express = require('express'); // Last Deploy: 2026-04-14
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cache = new NodeCache({ stdTTL: 15 });
const cacheMiddleware = (duration = 15) => (req, res, next) => {
  if (req.method !== 'GET') return next();
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);
  if (cachedResponse) return res.json(cachedResponse);
  res.sendResponse = res.json;
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, body, duration);
    }
    res.sendResponse(body);
  };
  next();
};

const activePromises = new Map();
async function coalesceRequest(key, fetchFunction) {
  if (activePromises.has(key)) {
    return activePromises.get(key);
  }
  const promise = fetchFunction().finally(() => {
    activePromises.delete(key);
  });
  activePromises.set(key, promise);
  return promise;
}

const app = express();
app.use(compression());
app.use(morgan('dev'));
const PORT = process.env.PORT || 5007;

// Android Capacitor apps send requests from these origins
const androidOrigins = [
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
];

const envOrigin = process.env.ALLOWED_ORIGIN || '';

// Build allowed origins list
const allowedOrigins = [
  ...androidOrigins,
  ...(envOrigin && envOrigin !== '*' ? [envOrigin] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow if origin is in our list
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow if env is wildcard
    if (!envOrigin || envOrigin === '*') return callback(null, true);
    // Block unknown origins
    callback(new Error('CORS: Origin not allowed - ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Google Sheets Sync Helper
async function syncToGoogleSheets(action, payload) {
  // Hardcoded to avoid missing .env issues on cloud server
  const url = 'https://script.google.com/macros/s/AKfycbwSah3tejW0xTkCIdKoPBllvan3dvzkxmA9Q3XdlcBWnd5TQa15AmU6_rPf7dW9qy0R/exec';
  if (!url) return;
  try {
    const data = { action, ...payload };
    await axios.post(url, data, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`[Google Sheets Sync] Error: ${error.message}`);
  }
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Collection Control Backend is running!' });
});

// Utility to calculate dynamic 20 Rs daily late penalty
const getPenalty = (scheduledDate, scheduleStatus) => {
  const cleanStatus = scheduleStatus ? String(scheduleStatus).trim() : '';
  if (cleanStatus === 'Paid' || cleanStatus === 'Verified' || cleanStatus === 'Received') return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date(todayStr);
  const schedObj = new Date(scheduledDate);
  
  const diffTime = todayObj - schedObj;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays * 20 : 0;
};

// ============================================================
// CENTRAL EMI STRUCTURE — Single source of truth for all loan amounts
// Any change to EMI structure must be made HERE only.
// ============================================================
const EMI_STRUCTURES = {
  10000: { 1:1100, 2:1100, 3:1100, 4:1100, 5:1080, 6:1080, 7:1080, 8:1080, 9:1070, 10:1070, 11:1070, 12:1070 },
  11000: { 1:1050, 2:1050, 3:1050, 4:1050, 5:1020, 6:1020, 7:1020, 8:1020, 9:980, 10:980, 11:980, 12:980, 13:950, 14:950, 15:950, 16:950 },
  12000: { 1:1050, 2:1050, 3:1050, 4:1050, 5:1020, 6:1020, 7:1020, 8:1020, 9:980, 10:980, 11:980, 12:980, 13:950, 14:950, 15:950, 16:950 },
  13000: { 1:990, 2:990, 3:990, 4:990, 5:970, 6:970, 7:970, 8:970, 9:940, 10:940, 11:940, 12:940, 13:910, 14:910, 15:910, 16:910, 17:890, 18:890 },
  15000: { 1:1000, 2:1000, 3:1000, 4:1000, 5:980, 6:980, 7:980, 8:980, 9:960, 10:960, 11:960, 12:960, 13:940, 14:940, 15:940, 16:940, 17:920, 18:920, 19:920, 20:920, 21:900, 22:900 }
};

const getEMIAmount = (amountSanctioned, weekNumber) => {
  const structure = EMI_STRUCTURES[amountSanctioned];
  if (!structure) return null;
  return structure[weekNumber] || null;
};

// ============================================================
// AUTO-HEAL: Silently fix null loan_ids + wrong amounts for a center
// Called in background whenever bills are fetched — zero UI impact
// ============================================================
async function autoHealCenter(centerId) {
  try {
    // 1. Fetch loans for this center
    const { data: loans } = await supabase.from('loans').select('id, member_name, amount_sanctioned, member_id').eq('center_id', centerId);
    if (!loans || loans.length === 0) return;

    const loanByName = {};
    const loanById = {};
    loans.forEach(l => {
      loanByName[l.member_name?.trim()?.toLowerCase()] = l;
      loanById[l.id] = l;
    });

    // 2. Fetch all schedules for this center
    const { data: schedules } = await supabase.from('collection_schedules').select('*').eq('center_id', centerId);
    if (!schedules || schedules.length === 0) return;

    for (const s of schedules) {
      const updates = {};
      let loan = s.loan_id ? loanById[s.loan_id] : null;

      // Fix null loan_id by matching member_name
      if (!s.loan_id) {
        const matched = loanByName[s.member_name?.trim()?.toLowerCase()];
        if (matched) {
          updates.loan_id = matched.id;
          updates.member_id = matched.member_id;
          loan = matched;
        }
      }

      // Fix wrong EMI amount
      if (loan) {
        const correctAmount = getEMIAmount(loan.amount_sanctioned, s.week_number);
        if (correctAmount !== null && s.amount !== correctAmount) {
          updates.amount = correctAmount;
          // Also fix collected_amount for paid weeks if it was matching old wrong amount
          if (['Paid', 'Received', 'Verified'].includes(s.status) && s.collected_amount === s.amount) {
            updates.collected_amount = correctAmount;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('collection_schedules').update(updates).eq('id', s.id);
      }
    }
  } catch (err) {
    // Silent — auto-heal must never crash the main request
    console.error('[AutoHeal] Error:', err.message);
  }
}

// Stats for RO Dashboard
app.get('/api/stats', cacheMiddleware(15), async (req, res) => {
  try {
    const { staffId } = req.query;
    const cacheKey = `/api/stats?staffId=${staffId || ''}`;
    
    const result = await coalesceRequest(cacheKey, async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Step 0: Identify allowed centers if staffId is provided
      let allowedCenterIds = null;
      if (staffId) {
        const { data: staffCenters } = await supabase
          .from('centers')
          .select('id')
          .ilike('staff_id', staffId);
        allowedCenterIds = (staffCenters || []).map(c => c.id);
        
        if (allowedCenterIds.length === 0) {
          return { targetToday: 0, collectedToday: 0, activeCenters: 0, efficiency: 0 };
        }
      }

      // 1. Current Target Collection (Dues up to today)
      let schQuery = supabase
        .from('collection_schedules')
        .select('amount, status, collected_amount, loan_id, member_id, scheduled_date, approved_at, center_id')
        .order('scheduled_date', { ascending: true });

      if (allowedCenterIds) {
        schQuery = schQuery.in('center_id', allowedCenterIds);
      }

      const { data: allSchedules, error: schError } = await schQuery;

      if (schError) throw schError;

      let targetToday = 0; // Remaining total due as of RIGHT NOW
      let strictlyCollectedToday = 0; // Cash physically collected today
      let startOfDayTarget = 0; // What was due when the RO woke up today

      const { data: allCentersData } = await supabase.from('centers').select('id, name');
      const centerMap = {};
      (allCentersData || []).forEach(c => centerMap[c.id] = c.name);

      let centerTargets = {};

      (allSchedules || []).forEach(s => {
        if (s.scheduled_date <= today) {
          const penalty = getPenalty(s.scheduled_date, s.status);
          const fullAmount = (Number(s.amount) || 0) + penalty;
          const collected = Number(s.collected_amount) || 0;
          const due = fullAmount - collected;
          
          // 1. Calculate remaining target currently
          if (s.status !== 'Paid') {
            const dueAmount = due > 0 ? due : 0;
            targetToday += dueAmount;
            
            if (dueAmount > 0 && s.center_id) {
              if (!centerTargets[s.center_id]) centerTargets[s.center_id] = 0;
              centerTargets[s.center_id] += dueAmount;
            }
          }

          // 2. Calculate Efficiency strictly for TODAY's efforts
          const approvedDate = s.approved_at ? s.approved_at.split('T')[0] : null;
          
          if (approvedDate === today) {
            // If a payment was made TODAY, the target this morning included what they just paid
            strictlyCollectedToday += collected;
            startOfDayTarget += (due > 0 ? due : 0) + collected;
          } else if (s.status !== 'Paid') {
            // If no payment was made today, whatever is due right now was also due this morning
            startOfDayTarget += due > 0 ? due : 0;
          }
        }
      });

      const efficiency = startOfDayTarget > 0 
        ? Math.round((strictlyCollectedToday / startOfDayTarget) * 100) 
        : 0;

      // We override collectedToday to reflect today's actual cash collection for the Sidebar UI
      let collectedToday = strictlyCollectedToday;

      // 2. Active Centers Count
      let loanQuery = supabase
        .from('loans')
        .select('center_id')
        .eq('status', 'DISBURSED');

      if (allowedCenterIds) {
        loanQuery = loanQuery.in('center_id', allowedCenterIds);
      }

      const { data: activeLoans, error: loanError } = await loanQuery;

      if (loanError) throw loanError;
      const activeCenters = [...new Set(activeLoans.map(l => l.center_id))].length;

      const centerDues = Object.keys(centerTargets).map(id => ({
        id,
        name: centerMap[id] || 'Unknown Center',
        due: centerTargets[id]
      })).sort((a, b) => a.name.localeCompare(b.name));

      return {
        targetToday,
        collectedToday,
        activeCenters,
        efficiency,
        centerDues
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Centers with Active Collections
app.get('/api/centers', cacheMiddleware(15), async (req, res) => {
  try {
    const { staffId, date } = req.query;
    const cacheKey = `/api/centers?staffId=${staffId || ''}&date=${date || ''}`;

    const result = await coalesceRequest(cacheKey, async () => {
      const today = new Date().toISOString().split('T')[0];
      const targetDate = date || today;
      
      // Get distinct center IDs that have pending/partial schedules for the target date
      let schQuery = supabase
        .from('collection_schedules')
        .select('center_id')
        .eq('scheduled_date', targetDate)
        .not('status', 'in', '("Paid","Received","Verified")');

      // If staff filtering is needed for the initial list discovery
      if (staffId) {
        // We can either filter schedules by centers assigned to staff
        // OR fetch schedules first and then filter centers later.
        // Let's optimize by getting staff centers first.
        const { data: staffCenters } = await supabase
          .from('centers')
          .select('id')
          .ilike('staff_id', staffId);
        const staffCenterIds = (staffCenters || []).map(c => c.id);
        
        if (staffCenterIds.length === 0) return [];
        schQuery = schQuery.in('center_id', staffCenterIds);
      }

      const { data: pendingSchedules, error: schError } = await schQuery;

      if (schError) throw schError;

      const centerIds = [...new Set(pendingSchedules.map(s => s.center_id).filter(id => id != null))];

      if (centerIds.length === 0) {
        return [];
      }

      let centerQuery = supabase
        .from('centers')
        .select('*')
        .in('id', centerIds)
        .order('name', { ascending: true });
      
      if (staffId) {
        centerQuery = centerQuery.ilike('staff_id', staffId);
      }

      const { data: centers, error: centerError } = await centerQuery;
      
      if (centerError) throw centerError;
      return centers || [];
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET 12-Week Bills for a Center
app.get('/api/bills/:centerId', async (req, res) => {
  try {
    const { centerId } = req.params;

    // AUTO-HEAL: Run silently in background — fix null loan_ids & wrong amounts
    autoHealCenter(parseInt(centerId)).catch(() => {});
    
    // 1. Get all schedules for this center
    const { data: rawSchedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('*')
      .eq('center_id', centerId)
      .order('scheduled_date', { ascending: true });

    if (schError) throw schError;

    // Map schedules to include daily penalty
    const schedules = (rawSchedules || []).map(s => ({
      ...s,
      penalty: getPenalty(s.scheduled_date, s.status)
    }));

    // 2. Get members of this center — include CLOSED loans so frontend can show status
    const { data: members, error: memError } = await supabase
      .from('loans')
      .select('member_name, id, amount_sanctioned, member_photo_url, status, members(member_no)')
      .eq('center_id', centerId)
      .in('status', ['DISBURSED', 'ACTIVE', 'CREDITED', 'SANCTIONED', 'ARCHIVED', 'CLOSED']);

    if (memError) throw memError;

    const formattedMembers = (members || []).map(m => ({
      ...m,
      member_no: m.members?.member_no || null
    }));

    res.json({
      schedules: schedules || [],
      members: formattedMembers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Full system audit — fix all null loan_ids & wrong amounts across all centers
app.post('/api/admin/heal-all', async (req, res) => {
  try {
    const { data: centers } = await supabase.from('centers').select('id, name');
    if (!centers) return res.json({ message: 'No centers found' });

    let totalFixed = 0;
    const report = [];

    for (const center of centers) {
      const { data: loans } = await supabase.from('loans').select('id, member_name, amount_sanctioned, member_id').eq('center_id', center.id);
      if (!loans || loans.length === 0) continue;

      const loanByName = {};
      const loanById = {};
      loans.forEach(l => {
        loanByName[l.member_name?.trim()?.toLowerCase()] = l;
        loanById[l.id] = l;
      });

      const { data: schedules } = await supabase.from('collection_schedules').select('*').eq('center_id', center.id);
      if (!schedules || schedules.length === 0) continue;

      let centerFixed = 0;
      for (const s of schedules) {
        const updates = {};
        let loan = s.loan_id ? loanById[s.loan_id] : null;

        if (!s.loan_id) {
          const matched = loanByName[s.member_name?.trim()?.toLowerCase()];
          if (matched) {
            updates.loan_id = matched.id;
            updates.member_id = matched.member_id;
            loan = matched;
          }
        }

        if (loan) {
          const correctAmount = getEMIAmount(loan.amount_sanctioned, s.week_number);
          if (correctAmount !== null && s.amount !== correctAmount) {
            updates.amount = correctAmount;
            if (['Paid', 'Received', 'Verified'].includes(s.status) && s.collected_amount === s.amount) {
              updates.collected_amount = correctAmount;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('collection_schedules').update(updates).eq('id', s.id);
          if (!error) centerFixed++;
        }
      }

      if (centerFixed > 0) {
        totalFixed += centerFixed;
        report.push({ center: center.name, fixed: centerFixed });
      }
    }

    res.json({ message: 'Heal complete', totalFixed, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Record a payment for a specific schedule
app.post('/api/collections/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { collectedAmount } = req.body;

    // First find the original schedule amount + loan_id + member info
    const { data: schedule, error: schError } = await supabase
      .from('collection_schedules')
      .select('amount, scheduled_date, status, loan_id, member_id')
      .eq('id', id)
      .single();

    if (schError) throw schError;

    const penalty = getPenalty(schedule.scheduled_date, schedule.status);
    const targetAmount = Number(schedule.amount) + penalty;
    
    // If collectedAmount is not provided (undefined), default to targetAmount (Paid in Full)
    const amountToSave = (collectedAmount !== undefined && collectedAmount !== null) 
      ? Number(collectedAmount) 
      : targetAmount;

    let newStatus = 'Pending';
    if (amountToSave > 0 && amountToSave < targetAmount) {
      newStatus = 'Partial';
    } else if (amountToSave >= targetAmount) {
      newStatus = 'Paid';
    }

    const { data, error } = await supabase
      .from('collection_schedules')
      .update({ 
        status: newStatus,
        collected_amount: amountToSave,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    // --- CHECK FOR LOAN CLOSURE ---
    // Trigger for every payment — handles ARCHIVED + DISBURSED loans equally
    let closedLoan = null;
    if (schedule.loan_id) {
      const { data: allLoanSchedules } = await supabase
        .from('collection_schedules')
        .select('status, scheduled_date')
        .eq('loan_id', schedule.loan_id)
        .order('scheduled_date', { ascending: true });

      let isFullyPaid = false;
      if (allLoanSchedules && allLoanSchedules.length > 0) {
        const lastSchedule = allLoanSchedules[allLoanSchedules.length - 1];
        const previousSchedules = allLoanSchedules.slice(0, -1);
        
        const lastOk = (lastSchedule.status === 'Paid' || lastSchedule.status === 'Received');
        const prevOk = previousSchedules.every(s => s.status === 'Received');
        
        isFullyPaid = lastOk && prevOk;
      }

      if (isFullyPaid) {
        const { data: closed } = await supabase
          .from('loans')
          .update({ status: 'CLOSED' })
          .eq('id', schedule.loan_id)
          .select('id, member_name, member_id, center_id')
          .maybeSingle();
        closedLoan = closed || null;
      }
    }

    // Google Sheets Sync: Remove specific schedule row when paid
    if (newStatus === 'Paid') {
      syncToGoogleSheets('REMOVE_PAID', { scheduleIds: [String(id)] });
    }

    res.json({ ...data[0], closedLoan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Batch Record Payments for a Center
app.post('/api/collections/batch-pay', async (req, res) => {
  try {
    const { payments } = req.body;
    if (!payments || !payments.length) return res.status(400).json({ error: 'No payments provided' });

    // Fetch original schedules to verify target amounts
    const scheduleIds = payments.map(p => p.scheduleId);
    const { data: schedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('id, amount, loan_id, scheduled_date, status')
      .in('id', scheduleIds);

    if (schError) throw schError;

    const updates = payments.map(payment => {
      const schedule = schedules.find(s => s.id === payment.scheduleId);
      if (!schedule) return null;

      const penalty = getPenalty(schedule.scheduled_date, schedule.status);
      const targetAmount = Number(schedule.amount) + penalty;
      const amountToSave = Number(payment.collectedAmount) || 0;

      let newStatus = 'Pending'; // Or whatever default
      if (amountToSave > 0 && amountToSave < targetAmount) {
        newStatus = 'Partial';
      } else if (amountToSave >= targetAmount) {
        newStatus = 'Paid';
      }

      return {
        id: payment.scheduleId,
        status: newStatus,
        collected_amount: amountToSave,
        approved_at: new Date().toISOString()
      };
    }).filter(u => u !== null);

    // Using Promise.all since Supabase currently handles bulk updates best via upsert or simple loop
    // Since we are updating specific rows, simple array mapping with update is fine.
    const results = await Promise.all(
      updates.map(update => 
        supabase.from('collection_schedules')
          .update(update)
          .eq('id', update.id)
          .select()
      )
    );

    // --- CHECK FOR LOAN CLOSURE ---
    // 1. Identify all affected loan IDs
    const affectedLoanIds = [...new Set(schedules.map(s => s.loan_id).filter(id => id != null))];
    const closedLoans = [];

    for (const loanId of affectedLoanIds) {
      // 2. Check if all schedules for this specific loan meet the closure criteria
      const { data: allLoanSchedules, error: checkError } = await supabase
        .from('collection_schedules')
        .select('status, scheduled_date')
        .eq('loan_id', loanId)
        .order('scheduled_date', { ascending: true });

      if (!checkError && allLoanSchedules && allLoanSchedules.length > 0) {
        const lastSchedule = allLoanSchedules[allLoanSchedules.length - 1];
        const previousSchedules = allLoanSchedules.slice(0, -1);
        
        const lastOk = (lastSchedule.status === 'Paid' || lastSchedule.status === 'Received');
        const prevOk = previousSchedules.every(s => s.status === 'Received');
        
        const isFullyPaid = lastOk && prevOk;
        
        if (isFullyPaid) {
          // 3. Update loan status to 'CLOSED'
          const { data: closedLoan, error: closeError } = await supabase
            .from('loans')
            .update({ status: 'CLOSED' })
            .eq('id', loanId)
            .select('id, member_name, member_id, center_id')
            .maybeSingle();

          if (!closeError && closedLoan) {
            closedLoans.push(closedLoan);
          }
        }
      }
    }

    // Google Sheets Sync: Remove specific schedule rows when paid
    const paidScheduleIds = updates.filter(u => u.status === 'Paid').map(u => String(u.id));
    if (paidScheduleIds.length > 0) {
      syncToGoogleSheets('REMOVE_PAID', { scheduleIds: paidScheduleIds });
    }

    res.json({ 
      message: 'Batch payments recorded successfully', 
      successCount: results.length,
      closedLoans 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// DELETE Center (cascade: storage images → schedules → loans → center)
app.delete('/api/centers/:id', async (req, res) => {
  const centerId = parseInt(req.params.id);
  if (!centerId) return res.status(400).json({ error: 'Invalid center ID' });

  try {
    // Step 1: Verify center exists
    const { data: center, error: ce } = await supabase
      .from('centers')
      .select('id, name')
      .eq('id', centerId)
      .single();
    if (ce || !center) return res.status(404).json({ error: 'Center not found' });

    // Step 2: Fetch all loan photo URLs BEFORE deleting loans
    const { data: loans, error: le } = await supabase
      .from('loans')
      .select('id, member_photo_url')
      .eq('center_id', centerId);
    if (le) throw le;

    // Step 3: Delete storage images for this center's loans only
    const photoUrls = (loans || []).map(l => l.member_photo_url).filter(Boolean);
    const storageDeleted = [];
    for (const url of photoUrls) {
      try {
        const filename = url.split('/').pop().split('?')[0];
        const { error: se } = await supabase.storage.from('loan-documents').remove([filename]);
        if (!se) storageDeleted.push(filename);
      } catch (_) {}
    }

    // Step 4: Delete collection_schedules for this center only
    const { error: e1, count: c1 } = await supabase
      .from('collection_schedules')
      .delete({ count: 'exact' })
      .eq('center_id', centerId);
    if (e1) throw e1;

    // Step 5: Delete loans for this center only
    const { error: e2, count: c2 } = await supabase
      .from('loans')
      .delete({ count: 'exact' })
      .eq('center_id', centerId);
    if (e2) throw e2;

    // Step 6: Delete the center itself
    const { error: e3 } = await supabase
      .from('centers')
      .delete()
      .eq('id', centerId);
    if (e3) throw e3;

    // Invalidate cache
    cache.flushAll();

    res.json({
      success: true,
      message: `Center "${center.name}" deleted successfully`,
      deleted: {
        center: center.name,
        schedules: c1 || 0,
        loans: c2 || 0,
        images: storageDeleted.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { staffId, password, role } = req.body;
  
  try {
    // Check if the user exists and the password matches in the 'staff' table
    // Using .eq for fast indexed case-normalized matching
    const { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('staff_id', String(staffId || '').trim().toUpperCase())
      .eq('password', String(password || '').trim())
      .single();

    if (error || !staff) {
      return res.status(401).json({ message: 'Invalid Staff ID or Password!' });
    }

    // Strict check for the 'Relationship Officer' role
    if (staff.role !== 'Relationship Officer') {
      return res.status(403).json({ message: 'Access Denied: Only Relationship Officers are permitted to enter this portal!' });
    }

    // Success response with actual name, ID, and branch from database
    return res.status(200).json({
      message: 'Login successful',
      role: staff.role,
      staffId: staff.staff_id,
      name: staff.name,
      branch: staff.branch
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Database authentication failed' });
  }
});

// Serve Static Files from Frontend Dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA Catch-all: Hand over non-API routes to React Router
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ============================================================
// AUTO-HEAL ALL CENTERS — Runs on startup and daily at midnight
// Fixes: null loan_ids + wrong EMI amounts across ALL centers
// ============================================================
async function autoHealAll(trigger = 'manual') {
  try {
    console.log(`[AutoHeal] Starting full system heal (trigger: ${trigger})...`);
    const { data: centers } = await supabase.from('centers').select('id, name');
    if (!centers || centers.length === 0) return;

    let totalFixed = 0;

    for (const center of centers) {
      const { data: loans } = await supabase
        .from('loans')
        .select('id, member_name, amount_sanctioned, member_id')
        .eq('center_id', center.id);
      if (!loans || loans.length === 0) continue;

      const loanByName = {};
      const loanById = {};
      loans.forEach(l => {
        loanByName[l.member_name?.trim()?.toLowerCase()] = l;
        loanById[l.id] = l;
      });

      const { data: schedules } = await supabase
        .from('collection_schedules')
        .select('id, loan_id, member_id, member_name, week_number, amount, collected_amount, status')
        .eq('center_id', center.id);
      if (!schedules || schedules.length === 0) continue;

      let centerFixed = 0;
      for (const s of schedules) {
        const updates = {};
        let loan = s.loan_id ? loanById[s.loan_id] : null;

        // Fix 1: Null loan_id — match by member name
        if (!s.loan_id) {
          const matched = loanByName[s.member_name?.trim()?.toLowerCase()];
          if (matched) {
            updates.loan_id = matched.id;
            updates.member_id = matched.member_id;
            loan = matched;
          }
        }

        // Fix 2: Wrong EMI amount
        if (loan) {
          const correctAmount = getEMIAmount(loan.amount_sanctioned, s.week_number);
          if (correctAmount !== null && s.amount !== correctAmount) {
            updates.amount = correctAmount;
            // Fix collected_amount for paid weeks only if it exactly matched the old wrong amount
            if (['Paid', 'Received', 'Verified'].includes(s.status) && s.collected_amount === s.amount) {
              updates.collected_amount = correctAmount;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('collection_schedules').update(updates).eq('id', s.id);
          if (!error) centerFixed++;
        }
      }

      if (centerFixed > 0) {
        totalFixed += centerFixed;
        console.log(`[AutoHeal] ${center.name}: fixed ${centerFixed} record(s)`);
      }
    }

    console.log(`[AutoHeal] Done. Total fixed: ${totalFixed} record(s).`);
    cache.flushAll(); // Clear cache so fresh data is served after heal
  } catch (err) {
    console.error('[AutoHeal] Error during full heal:', err.message);
  }
}

// ============================================================
// CRON JOB: Sync pending collections to Google Sheets at 6 PM daily
// ============================================================
cron.schedule('0 18 * * *', async () => {
  console.log('[Cron] Starting Google Sheets sync for pending collections...');
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Fetch pending schedules (<= today)
    const { data: schedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('id, amount, status, collected_amount, scheduled_date, member_id, loan_id, center_id, center_name, member_name')
      .lte('scheduled_date', today)
      .not('status', 'in', '("Paid","Received","Verified")');
      
    if (schError) throw schError;
    if (!schedules || schedules.length === 0) {
      console.log('[Cron] No pending schedules found for today.');
      return;
    }
    
    // 2. Fetch associated loans for member_no and mobile numbers
    const loanIds = [...new Set(schedules.map(s => s.loan_id).filter(Boolean))];
    
    const { data: loans, error: loanError } = await supabase
      .from('loans')
      .select('id, mobile_no, nominee_mobile, members(member_no)')
      .in('id', loanIds);
      
    if (loanError) throw loanError;
    
    const loanMap = {};
    if (loans) {
      loans.forEach(l => {
        loanMap[l.id] = {
          mobile1: l.mobile_no || '',
          mobile2: l.nominee_mobile || '',
          memberNo: l.members?.member_no || ''
        };
      });
    }

    // 3. Format records
    const records = schedules.map(s => {
      const penalty = getPenalty(s.scheduled_date, s.status);
      const targetAmount = Number(s.amount) + penalty;
      const amountDue = targetAmount - (Number(s.collected_amount) || 0);
      
      const loanInfo = loanMap[s.loan_id] || { mobile1: '', mobile2: '', memberNo: '' };
      
      return {
        memberId: loanInfo.memberNo || s.member_name, // fallback to name if ID missing
        centerName: s.center_name || '',
        memberName: s.member_name || '',
        mobile1: loanInfo.mobile1,
        mobile2: loanInfo.mobile2,
        pendingDate: s.scheduled_date,
        pendingDue: amountDue,
        collectedAmount: Number(s.collected_amount) || 0,
        status: s.status,
        scheduleId: s.id
      };
    });
    
    // 4. Send to Google Sheets
    await syncToGoogleSheets('ADD_PENDING', { records });
    console.log(`[Cron] Synced ${records.length} pending records to Google Sheets.`);
    
  } catch (err) {
    console.error('[Cron] Error syncing to Google Sheets:', err.message);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Collection Control Backend running on port ${PORT}`);

  // LAYER 1: Heal everything on server startup
  autoHealAll('startup');

  // LAYER 2: Daily automatic heal — runs every 24 hours at midnight
  const msUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
  };

  // First fire at next midnight, then every 24h
  setTimeout(() => {
    autoHealAll('daily-midnight');
    setInterval(() => autoHealAll('daily-midnight'), 24 * 60 * 60 * 1000);
  }, msUntilMidnight());

  console.log(`[AutoHeal] Startup heal running. Next daily heal at midnight.`);
});
