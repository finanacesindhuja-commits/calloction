require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateLastWeekBills() {
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
  if (billsToUpdate.length === 0) return;

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const bill of billsToUpdate) {
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({
        status: 'Paid',
        collected_amount: bill.amount,
        approved_at: now
      })
      .eq('id', bill.id);
    
    if (updateError) {
      console.error(`Error updating bill ${bill.id}:`, updateError);
    } else {
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount}/${billsToUpdate.length} bills to Paid.`);

  // Optional: Update loans to CLOSED if all bills are paid. 
  // Getting distinct loan ids
  const affectedLoanIds = [...new Set(billsToUpdate.map(b => b.loan_id).filter(id => id != null))];
  
  let closedCount = 0;
  for (const loanId of affectedLoanIds) {
    const { data: allLoanSchedules, error: checkError } = await supabase
      .from('collection_schedules')
      .select('status')
      .eq('loan_id', loanId);

    if (!checkError && allLoanSchedules && allLoanSchedules.length > 0) {
      const isFullyPaid = allLoanSchedules.every(s => s.status === 'Paid');
      
      if (isFullyPaid) {
        const { error: closeError } = await supabase
          .from('loans')
          .update({ status: 'CLOSED' })
          .eq('id', loanId);

        if (!closeError) {
          closedCount++;
        }
      }
    }
  }
  console.log(`Closed ${closedCount} loans that are now fully paid.`);
}

updateLastWeekBills();
