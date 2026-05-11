const express = require('express'); // Last Deploy: 2026-04-14
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
app.use(compression());
app.use(morgan('dev'));
const PORT = process.env.PORT || 5007;

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Collection Control Backend is running!' });
});

// Utility to calculate dynamic 20 Rs daily late penalty
const getPenalty = (scheduledDate, scheduleStatus) => {
  if (scheduleStatus === 'Paid' || scheduleStatus === 'Verified' || scheduleStatus === 'Received') return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date(todayStr);
  const schedObj = new Date(scheduledDate);
  
  const diffTime = todayObj - schedObj;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays * 20 : 0;
};

// Stats for RO Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const { staffId } = req.query;
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
        return res.json({ targetToday: 0, collectedToday: 0, activeCenters: 0, efficiency: 0 });
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

    (allSchedules || []).forEach(s => {
      if (s.scheduled_date <= today) {
        const penalty = getPenalty(s.scheduled_date, s.status);
        const fullAmount = (Number(s.amount) || 0) + penalty;
        const collected = Number(s.collected_amount) || 0;
        const due = fullAmount - collected;
        
        // 1. Calculate remaining target currently
        if (s.status !== 'Paid') {
          targetToday += due > 0 ? due : 0;
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

    res.json({
      targetToday,
      collectedToday,
      activeCenters,
      efficiency
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Centers with Active Collections
app.get('/api/centers', async (req, res) => {
  try {
    const { staffId, date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const targetDate = date || today;
    
    // Get distinct center IDs that have pending/partial schedules for the target date
    let schQuery = supabase
      .from('collection_schedules')
      .select('center_id')
      .eq('scheduled_date', targetDate)
      .neq('status', 'Paid');

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
      
      if (staffCenterIds.length === 0) return res.json([]);
      schQuery = schQuery.in('center_id', staffCenterIds);
    }

    const { data: pendingSchedules, error: schError } = await schQuery;

    if (schError) throw schError;

    const centerIds = [...new Set(pendingSchedules.map(s => s.center_id).filter(id => id != null))];

    if (centerIds.length === 0) {
      return res.json([]);
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
    res.json(centers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET 12-Week Bills for a Center
app.get('/api/bills/:centerId', async (req, res) => {
  try {
    const { centerId } = req.params;
    
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

    // 2. Get members of this center
    const { data: members, error: memError } = await supabase
      .from('loans')
      .select('member_name, id, amount_sanctioned, loan_app_id, member_photo_url, members(member_no)')
      .eq('center_id', centerId)
      .in('status', ['DISBURSED', 'ACTIVE', 'CREDITED', 'SANCTIONED', 'ARCHIVED']);

    if (memError) throw memError;

    const formattedMembers = (members || []).map(m => ({
      ...m,
      member_no: m.members?.member_no || null,
      loan_app_id: m.loan_app_id || null
    }));

    res.json({
      schedules: schedules || [],
      members: formattedMembers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Record a payment for a specific schedule
app.post('/api/collections/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { collectedAmount } = req.body;

    // First find the original schedule amount
    const { data: schedule, error: schError } = await supabase
      .from('collection_schedules')
      .select('amount, scheduled_date, status')
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
    res.json(data[0]);
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
      // 2. Check if all schedules for this specific loan are now 'Paid'
      const { data: allLoanSchedules, error: checkError } = await supabase
        .from('collection_schedules')
        .select('status')
        .eq('loan_id', loanId);

      if (!checkError && allLoanSchedules && allLoanSchedules.length > 0) {
        const isFullyPaid = allLoanSchedules.every(s => s.status === 'Paid');
        
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

    res.json({ 
      message: 'Batch payments recorded successfully', 
      successCount: results.length,
      closedLoans 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/login', async (req, res) => {
  const { staffId, password, role } = req.body;
  
  try {
    // Check if the user exists and the password matches in the 'staff' table
    // Using .ilike for case-insensitive Staff ID matching
    const { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .ilike('staff_id', staffId)
      .eq('password', password)
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Collection Control Backend running on port ${PORT}`);
});
