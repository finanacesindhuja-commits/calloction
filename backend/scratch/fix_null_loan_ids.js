require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixNullLoanIds() {
  const { data: bills, error: billsErr } = await supabase
    .from('collection_schedules')
    .select('id, member_id')
    .is('loan_id', null);

  if (billsErr || !bills) return console.error(billsErr);
  
  const { data: loans, error: loansErr } = await supabase
    .from('loans')
    .select('id, member_id');

  if (loansErr || !loans) return console.error(loansErr);

  console.log(`Fixing ${bills.length} bills...`);
  
  let fixedCount = 0;
  for (const bill of bills) {
    const loan = loans.find(l => l.id === bill.member_id);
    if (loan) {
      const { error } = await supabase
        .from('collection_schedules')
        .update({
          loan_id: loan.id,
          member_id: loan.member_id
        })
        .eq('id', bill.id);
        
      if (!error) fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} bills.`);

  // Now re-check ALL loans to see if they should be CLOSED
  console.log('Re-evaluating loan closures...');
  
  // Find all loans that are currently NOT CLOSED
  const { data: activeLoans } = await supabase
    .from('loans')
    .select('id')
    .neq('status', 'CLOSED');
    
  let closedCount = 0;
  for (const l of activeLoans) {
    const { data: loanSchedules } = await supabase
      .from('collection_schedules')
      .select('status')
      .eq('loan_id', l.id);
      
    if (loanSchedules && loanSchedules.length > 0) {
      const isFullyPaid = loanSchedules.every(s => s.status === 'Paid');
      if (isFullyPaid) {
        await supabase
          .from('loans')
          .update({ status: 'CLOSED' })
          .eq('id', l.id);
        closedCount++;
      }
    }
  }
  console.log(`Closed ${closedCount} loans that are fully paid!`);
}

fixNullLoanIds();
