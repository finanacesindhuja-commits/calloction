const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const getPenalty = (scheduledDate, scheduleStatus) => {
  const cleanStatus = scheduleStatus ? String(scheduleStatus).trim() : '';
  if (cleanStatus === 'Paid' || cleanStatus === 'Verified' || cleanStatus === 'Received') return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date(todayStr);
  const schedObj = new Date(scheduledDate);
  
  const diffTime = todayObj - schedObj;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays * 20 : 0;
};

async function executePayment() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: schedules, error: schError } = await supabase
    .from('collection_schedules')
    .select('*')
    .lte('scheduled_date', today)
    .not('status', 'in', '("Paid","Received","Verified")');
    
  if (schError) throw schError;
  
  console.log(`Found ${schedules.length} pending schedules.`);
  
  // Exclude Valarmathi
  const toUpdate = schedules.filter(s => s.member_name !== 'Valarmathi D');
  console.log(`Will update ${toUpdate.length} schedules. Excluding ${schedules.length - toUpdate.length} schedules (Valarmathi).`);
  
  let successCount = 0;
  let closedLoans = [];
  
  for (const schedule of toUpdate) {
    const penalty = getPenalty(schedule.scheduled_date, schedule.status);
    const targetAmount = Number(schedule.amount) + penalty;
    
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({
        status: 'Received',
        collected_amount: targetAmount,
        approved_at: new Date().toISOString()
      })
      .eq('id', schedule.id);
      
    if (updateError) {
      console.error(`Failed to update schedule ${schedule.id}:`, updateError);
    } else {
      successCount++;
    }
  }
  
  console.log(`Successfully updated ${successCount} schedules to 'Received'.`);
  
  // Check for closed loans
  const affectedLoanIds = [...new Set(toUpdate.map(s => s.loan_id).filter(id => id != null))];
  
  for (const loanId of affectedLoanIds) {
    const { data: allLoanSchedules, error: checkError } = await supabase
      .from('collection_schedules')
      .select('status')
      .eq('loan_id', loanId);

    if (!checkError && allLoanSchedules && allLoanSchedules.length > 0) {
      const isFullyPaid = allLoanSchedules.every(s => s.status === 'Paid' || s.status === 'Received' || s.status === 'Verified');
      
      if (isFullyPaid) {
        const { error: closeError } = await supabase
          .from('loans')
          .update({ status: 'CLOSED' })
          .eq('id', loanId);

        if (!closeError) {
          closedLoans.push(loanId);
        }
      }
    }
  }
  
  console.log(`Closed ${closedLoans.length} loans.`);
}

executePayment().catch(console.error);
