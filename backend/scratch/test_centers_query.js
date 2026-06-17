require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testBackendCentersQuery() {
  const staffId = 'STF006';
  const targetDate = '2026-06-10';

  console.log('--- Step 1: get staff centers ---');
  const { data: staffCenters, error: err1 } = await supabase
    .from('centers')
    .select('id')
    .ilike('staff_id', staffId);
  const staffCenterIds = (staffCenters || []).map(c => c.id);
  console.log('Staff center IDs:', staffCenterIds);

  console.log('--- Step 2: get pending schedules ---');
  let schQuery = supabase
    .from('collection_schedules')
    .select('center_id')
    .eq('scheduled_date', targetDate)
    .not('status', 'in', '("Paid","Received","Verified")');

  schQuery = schQuery.in('center_id', staffCenterIds);

  const { data: pendingSchedules, error: schError } = await schQuery;
  if (schError) {
    console.error('Error fetching schedules:', schError);
    return;
  }
  console.log('Pending schedules found count:', pendingSchedules.length);
  const centerIds = [...new Set(pendingSchedules.map(s => s.center_id).filter(id => id != null))];
  console.log('Unique center IDs with pending schedules on this date:', centerIds);

  console.log('--- Step 3: get centers detail ---');
  let centerQuery = supabase
    .from('centers')
    .select('*')
    .in('id', centerIds)
    .order('name', { ascending: true });
  
  centerQuery = centerQuery.ilike('staff_id', staffId);

  const { data: centers, error: centerError } = await centerQuery;
  if (centerError) {
    console.error('Error fetching centers info:', centerError);
    return;
  }
  console.log('Centers returned from API:');
  console.table(centers.map(c => ({ id: c.id, name: c.name })));
}

testBackendCentersQuery();
