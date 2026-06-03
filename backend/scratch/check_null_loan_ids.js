require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkNullLoanIds() {
  const { data: bills, error } = await supabase
    .from('collection_schedules')
    .select('id, center_id, center_name, member_id, loan_id, member_name')
    .is('loan_id', null);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Found ${bills.length} bills with null loan_id.`);
  if (bills.length > 0) {
    // Group by center
    const centers = {};
    for (const b of bills) {
      centers[b.center_name] = (centers[b.center_name] || 0) + 1;
    }
    console.log('Centers affected:', centers);
  }
}

checkNullLoanIds();
