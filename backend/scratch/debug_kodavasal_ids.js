require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugKodavasalIds() {
  const centerId = 6;
  
  // Fetch loans for this center
  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('id, member_name, member_id, amount_sanctioned, status')
    .eq('center_id', centerId);

  console.log(`Loans for Center ${centerId}:`);
  console.log(loans);

  // Fetch unique bills for this center
  const { data: schedules, error: schErr } = await supabase
    .from('collection_schedules')
    .select('id, member_name, amount, scheduled_date, status, loan_id, member_id')
    .eq('center_id', centerId);

  console.log(`\nSample bills:`);
  console.log(schedules.slice(0, 5));
  
  // Check if all loan_ids and member_ids are null
  const nullLoanIds = schedules.filter(s => s.loan_id == null).length;
  const nullMemberIds = schedules.filter(s => s.member_id == null).length;
  console.log(`\nTotal bills: ${schedules.length}`);
  console.log(`Bills with null loan_id: ${nullLoanIds}`);
  console.log(`Bills with null member_id: ${nullMemberIds}`);
}

debugKodavasalIds();
