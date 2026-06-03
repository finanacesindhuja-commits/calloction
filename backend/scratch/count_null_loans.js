require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countNullLoans() {
  const { data, error } = await supabase
    .from('collection_schedules')
    .select('id, member_name, status')
    .is('loan_id', null);

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log(`Schedules with null loan_id: ${data.length}`);
  if (data.length > 0) {
    console.log(data);
  }
}

countNullLoans();
