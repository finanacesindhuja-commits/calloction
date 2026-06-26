require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function revertBills() {
  const cutoffDate = '2026-06-26';
  console.log(`Reverting bills for Sumathi and Valarmathi before ${cutoffDate}...`);

  const { data: billsToRevert, error: fetchError } = await supabase
    .from('collection_schedules')
    .select('id, amount, status, scheduled_date, loan_id, member_name')
    .lt('scheduled_date', cutoffDate)
    .in('status', ['Paid', 'Received']);

  if (fetchError) {
    console.error('Error fetching data:', fetchError);
    return;
  }

  const filteredBills = billsToRevert.filter(b => 
    b.member_name && 
    (b.member_name.toLowerCase().includes('sumathi') || b.member_name.toLowerCase().includes('valarmathi'))
  );

  console.log(`Found ${filteredBills.length} bills to revert for Sumathi/Valarmathi.`);
  if (filteredBills.length === 0) return;

  let revertedCount = 0;

  for (const bill of filteredBills) {
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({
        status: 'Approved',
        collected_amount: 0,
        approved_at: null
      })
      .eq('id', bill.id);
    
    if (updateError) {
      console.error(`Error reverting bill ${bill.id}:`, updateError);
    } else {
      revertedCount++;
    }
  }
  
  console.log(`Successfully reverted ${revertedCount}/${filteredBills.length} bills.`);

  // Also need to reopen the loans if they were closed.
  const affectedLoanIds = [...new Set(filteredBills.map(b => b.loan_id).filter(id => id != null))];
  
  let reopenedCount = 0;
  for (const loanId of affectedLoanIds) {
    const { data: loanData } = await supabase.from('loans').select('status').eq('id', loanId).single();
    if (loanData && loanData.status === 'CLOSED') {
      const { error: openError } = await supabase
        .from('loans')
        .update({ status: 'ACTIVE' }) // Or DISBURSED
        .eq('id', loanId);
      if (!openError) reopenedCount++;
    }
  }
  console.log(`Reopened ${reopenedCount} loans.`);
}

revertBills();
