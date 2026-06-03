require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function find2160() {
  console.log("Searching for 2160 in collection_schedules...");
  
  // Search in collection_schedules
  const { data: schedules, error: schedError } = await supabase
    .from('collection_schedules')
    .select('*')
    .or('collected_amount.eq.2160,amount.eq.2160');

  if (schedError) {
    console.error('Error querying collection_schedules:', schedError);
  } else {
    console.log(`Found ${schedules.length} matching rows in collection_schedules:`);
    schedules.forEach(s => {
      console.log(`ID: ${s.id}, Member: ${s.member_name}, Scheduled Date: ${s.scheduled_date}, Center ID: ${s.center_id}, Amount: ${s.amount}, Collected: ${s.collected_amount}, Status: ${s.status}`);
    });
  }

  // Also let's search if there are loans with amount = 2160 or similar
  console.log("\nSearching for 2160 in loans...");
  const { data: loans, error: loanError } = await supabase
    .from('loans')
    .select('id, member_id, loan_amount, installment_amount, center_id, status')
    .or('loan_amount.eq.2160,installment_amount.eq.2160');

  if (loanError) {
    console.error('Error querying loans:', loanError);
  } else {
    console.log(`Found ${loans.length} matching loans:`);
    loans.forEach(l => {
      console.log(`Loan ID: ${l.id}, Member ID: ${l.member_id}, Loan Amount: ${l.loan_amount}, Installment Amount: ${l.installment_amount}, Status: ${l.status}`);
    });
  }
}

find2160();
