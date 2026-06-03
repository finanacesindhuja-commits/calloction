require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecifics() {
  const ids = [151, 163, 175];
  const { data, error } = await supabase
    .from('collection_schedules')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log("Specific schedules details:");
  data.forEach(s => {
    console.log(`ID: ${s.id}, loan_id: ${s.loan_id}, member_id: ${s.member_id}, member_name: "${s.member_name}", amount: ${s.amount}, status: ${s.status}`);
  });
}

checkSpecifics();
