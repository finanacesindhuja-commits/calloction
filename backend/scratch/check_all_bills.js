require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAllBills() {
  const centerId = 6;
  
  const { data: schedules, error: schErr } = await supabase
    .from('collection_schedules')
    .select('id, member_name, amount, scheduled_date, loan_id, member_id')
    .eq('center_id', centerId);

  // Group by member_name to see what IDs they have
  const map = {};
  for(const s of schedules) {
    if (!map[s.member_name]) map[s.member_name] = { member_ids: new Set(), loan_ids: new Set() };
    map[s.member_name].member_ids.add(s.member_id);
    map[s.member_name].loan_ids.add(s.loan_id);
  }
  
  console.log(map);
}

checkAllBills();
