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

// Stats for RO Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Current Target Collection (Dues up to today)
    const { data: allSchedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('amount, status, collected_amount, loan_id, member_id, scheduled_date')
      .order('scheduled_date', { ascending: true });

    if (schError) throw schError;

    let targetToday = 0; // Remaining total due as of RIGHT NOW
    let strictlyCollectedToday = 0; // Cash physically collected today
    let startOfDayTarget = 0; // What was due when the RO woke up today

    (allSchedules || []).forEach(s => {
      if (s.scheduled_date <= today) {
        const fullAmount = Number(s.amount) || 0;
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
    const { data: activeLoans, error: loanError } = await supabase
      .from('loans')
      .select('center_id')
      .eq('status', 'DISBURSED');

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
    const today = new Date().toISOString().split('T')[0];
    
    // Get distinct center IDs that have pending/partial schedules up to today
    const { data: pendingSchedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('center_id')
      .lte('scheduled_date', today)
      .neq('status', 'Paid');

    if (schError) throw schError;

    const centerIds = [...new Set(pendingSchedules.map(s => s.center_id).filter(id => id != null))];

    if (centerIds.length === 0) {
      return res.json([]);
    }

    const { data: centers, error: centerError } = await supabase
      .from('centers')
      .select('*')
      .in('id', centerIds)
      .order('name', { ascending: true });
    
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
    const { data: schedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('*')
      .eq('center_id', centerId)
      .order('scheduled_date', { ascending: true });

    if (schError) throw schError;

    // 2. Get members of this center
    const { data: members, error: memError } = await supabase
      .from('loans')
      .select('member_name, id, amount_sanctioned, loan_app_id, members(member_no)')
      .eq('center_id', centerId)
      .eq('status', 'DISBURSED');

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
      .select('amount')
      .eq('id', id)
      .single();

    if (schError) throw schError;

    const targetAmount = Number(schedule.amount);
    const amountToSave = Number(collectedAmount) || 0;

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
      .select('id, amount')
      .in('id', scheduleIds);

    if (schError) throw schError;

    const updates = payments.map(payment => {
      const schedule = schedules.find(s => s.id === payment.scheduleId);
      if (!schedule) return null;

      const targetAmount = Number(schedule.amount);
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

    res.json({ message: 'Batch payments recorded successfully', successCount: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/login', (req, res) => {
  const { staffId, password, role } = req.body;
  if (role !== 'Relationship Officer') {
    return res.status(403).json({ message: 'Access Denied!' });
  }
  return res.status(200).json({
    message: 'Login successful',
    role: 'Relationship Officer',
    staffId: staffId,
    name: 'Relationship Officer'
  });
});

// Serve Static Files from Frontend Dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Collection Control Backend running on port ${PORT}`);
});
