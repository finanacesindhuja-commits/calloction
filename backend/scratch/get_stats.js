require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getPenalty = (scheduledDate, scheduleStatus) => {
  if (scheduleStatus === 'Paid' || scheduleStatus === 'Verified' || scheduleStatus === 'Received') return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date(todayStr);
  const schedObj = new Date(scheduledDate);
  
  const diffTime = todayObj - schedObj;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays * 20 : 0;
};

async function computeStats(staffId) {
  const today = new Date().toISOString().split('T')[0];
  let allowedCenterIds = null;
  if (staffId) {
    const { data: staffCenters } = await supabase
      .from('centers')
      .select('id')
      .ilike('staff_id', staffId);
    allowedCenterIds = (staffCenters || []).map(c => c.id);
    console.log(`Staff ${staffId} has center IDs: ${allowedCenterIds.join(', ')}`);
    if (allowedCenterIds.length === 0) {
      return { targetToday: 0, collectedToday: 0, activeCenters: 0, efficiency: 0 };
    }
  }

  let schQuery = supabase
    .from('collection_schedules')
    .select('amount, status, collected_amount, loan_id, member_id, scheduled_date, approved_at, center_id')
    .order('scheduled_date', { ascending: true });

  if (allowedCenterIds) {
    schQuery = schQuery.in('center_id', allowedCenterIds);
  }

  const { data: allSchedules, error: schError } = await schQuery;
  if (schError) throw schError;

  let targetToday = 0;
  let strictlyCollectedToday = 0;
  let startOfDayTarget = 0;

  (allSchedules || []).forEach(s => {
    if (s.scheduled_date <= today) {
      const penalty = getPenalty(s.scheduled_date, s.status);
      const fullAmount = (Number(s.amount) || 0) + penalty;
      const collected = Number(s.collected_amount) || 0;
      const due = fullAmount - collected;
      
      if (s.status !== 'Paid') {
        targetToday += due > 0 ? due : 0;
      }

      const approvedDate = s.approved_at ? s.approved_at.split('T')[0] : null;
      if (approvedDate === today) {
        strictlyCollectedToday += collected;
        startOfDayTarget += (due > 0 ? due : 0) + collected;
      } else if (s.status !== 'Paid') {
        startOfDayTarget += due > 0 ? due : 0;
      }
    }
  });

  const efficiency = startOfDayTarget > 0 
    ? Math.round((strictlyCollectedToday / startOfDayTarget) * 100) 
    : 0;

  return {
    targetToday,
    collectedToday: strictlyCollectedToday,
    efficiency
  };
}

async function run() {
  console.log("No staffId stats:", await computeStats(null));
  console.log("STF001 stats:", await computeStats("STF001"));
  console.log("STF006 stats:", await computeStats("STF006"));
}

run();
