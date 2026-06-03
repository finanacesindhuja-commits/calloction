require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMemberSchedules() {
  const { data: schedules, error } = await supabase
    .from('collection_schedules')
    .select('*')
    .eq('center_id', 6)
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  const groups = {};
  schedules.forEach(s => {
    if (!groups[s.member_name]) {
      groups[s.member_name] = [];
    }
    groups[s.member_name].push(s);
  });

  console.log("Schedules grouped by member name:");
  Object.keys(groups).forEach(name => {
    console.log(`\nMember: ${name} (Schedules count: ${groups[name].length})`);
    groups[name].forEach(s => {
      console.log(`  ID: ${s.id}, Date: ${s.scheduled_date}, Week: ${s.week_number}, Amount: ${s.amount}, Collected: ${s.collected_amount}, Status: ${s.status}, loan_id: ${s.loan_id}`);
    });
  });
}

checkMemberSchedules();
