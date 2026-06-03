require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPendingBills() {
  const cutoffDate = '2026-05-31';
  console.log(`Checking bills scheduled on or before ${cutoffDate}...`);

  const { data, error, count } = await supabase
    .from('collection_schedules')
    .select('id, amount, status, scheduled_date', { count: 'exact' })
    .lte('scheduled_date', cutoffDate)
    .neq('status', 'Paid');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`Found ${count} bills that are not Paid up to ${cutoffDate}.`);
  if (count > 0) {
    console.log('Sample of bills:');
    console.log(data.slice(0, 5));
  }
}

checkPendingBills();
