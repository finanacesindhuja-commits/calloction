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

async function checkCenters() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: centers } = await supabase.from('centers').select('id, name');
  const { data: schedules } = await supabase.from('collection_schedules').select('*');
  
  const centerMap = {};
  centers.forEach(c => {
    centerMap[c.id] = { name: c.name, targetToday: 0, collectedToday: 0, schedulesCount: 0 };
  });

  schedules.forEach(s => {
    if (s.scheduled_date <= today) {
      const penalty = getPenalty(s.scheduled_date, s.status);
      const fullAmount = (Number(s.amount) || 0) + penalty;
      const collected = Number(s.collected_amount) || 0;
      const due = fullAmount - collected;

      if (!centerMap[s.center_id]) {
        centerMap[s.center_id] = { name: `Unknown Center (${s.center_id})`, targetToday: 0, collectedToday: 0, schedulesCount: 0 };
      }

      centerMap[s.center_id].schedulesCount++;

      if (s.status !== 'Paid') {
        centerMap[s.center_id].targetToday += due > 0 ? due : 0;
      }

      const approvedDate = s.approved_at ? s.approved_at.split('T')[0] : null;
      if (approvedDate === today) {
        centerMap[s.center_id].collectedToday += collected;
      }
    }
  });

  console.log("Center Statistics for target/collected today:");
  Object.keys(centerMap).forEach(cid => {
    const c = centerMap[cid];
    if (c.targetToday > 0 || c.collectedToday > 0 || c.schedulesCount > 0) {
      console.log(`Center ID: ${cid}, Name: ${c.name}, Target: ${c.targetToday}, Collected: ${c.collectedToday}, SchedCount: ${c.schedulesCount}`);
    }
  });
}

checkCenters();
