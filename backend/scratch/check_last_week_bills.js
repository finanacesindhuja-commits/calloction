require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOldBills() {
  const cutoffDate = '2026-06-26';
  console.log(`Fetching bills scheduled strictly before ${cutoffDate}...`);

  const { data: billsToUpdate, error: fetchError } = await supabase
    .from('collection_schedules')
    .select('id, amount, status, scheduled_date, loan_id, member_name')
    .lt('scheduled_date', cutoffDate)
    .neq('status', 'Paid');

  if (fetchError) {
    console.error('Error fetching data:', fetchError);
    return;
  }

  console.log(`Found ${billsToUpdate.length} bills to mark as Paid.`);
  if (billsToUpdate.length > 0) {
    const sumathiBills = billsToUpdate.filter(b => b.member_name && b.member_name.toLowerCase().includes('sumathi'));
    const valarmathiBills = billsToUpdate.filter(b => b.member_name && b.member_name.toLowerCase().includes('valarmathi'));
    console.log(`Included Sumathi bills: ${sumathiBills.length}`);
    console.log(`Included Valarmathi bills: ${valarmathiBills.length}`);
  }
}

checkOldBills();
