require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSumathi() {
  const { data: bills, error } = await supabase
    .from('collection_schedules')
    .select('id, amount, status, scheduled_date, member_name')
    .ilike('member_name', '%Sumathi%')
    .order('scheduled_date', { ascending: true });
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Sumathi Bills:');
  bills.forEach(b => console.log(`${b.id}: ${b.scheduled_date} - ${b.status} - ${b.amount}`));
}

checkSumathi();
