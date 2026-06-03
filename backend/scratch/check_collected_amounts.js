require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCollectedAmounts() {
  const { data: bills, error } = await supabase
    .from('collection_schedules')
    .select('id, amount, collected_amount, status, member_name, scheduled_date')
    .eq('status', 'Paid');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const weirdBills = bills.filter(b => b.collected_amount !== b.amount);
  
  console.log(`Total Paid bills: ${bills.length}`);
  console.log(`Bills with collected_amount != amount: ${weirdBills.length}`);
  
  if (weirdBills.length > 0) {
    console.log('Sample weird bills (first 10):');
    console.log(weirdBills.slice(0, 10));
  }
}

checkCollectedAmounts();
