require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyNullLoanIds() {
  const { data: bills } = await supabase
    .from('collection_schedules')
    .select('id, member_id, member_name, center_id')
    .is('loan_id', null);

  const { data: loans } = await supabase
    .from('loans')
    .select('id, member_id, member_name, center_id');

  let matchCount = 0;
  let mismatchCount = 0;
  for (const b of bills) {
    // find loan where id == b.member_id and center_id == b.center_id
    const loan = loans.find(l => l.id === b.member_id && l.center_id === b.center_id);
    if (loan) {
      if (loan.member_name === b.member_name) {
        matchCount++;
      } else {
        console.log(`Name mismatch! Bill: ${b.member_name}, Loan: ${loan.member_name}`);
        mismatchCount++;
      }
    } else {
      console.log(`No loan found for bill ID: ${b.id}, member_name: ${b.member_name}, member_id(loan_id): ${b.member_id}`);
      mismatchCount++;
    }
  }

  console.log(`Match: ${matchCount}, Mismatch: ${mismatchCount}`);
}

verifyNullLoanIds();
