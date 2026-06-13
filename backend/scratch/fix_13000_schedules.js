require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getAmountForWeek(week) {
  if (week >= 1 && week <= 4) return 1050;
  if (week >= 5 && week <= 8) return 1020;
  if (week >= 9 && week <= 12) return 990;
  if (week >= 13 && week <= 16) return 970;
  if (week >= 17 && week <= 18) return 940;
  return 0;
}

async function fix13000Schedules() {
  console.log('Finding loans with amount_sanctioned = 13000...');
  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('id, member_name')
    .eq('amount_sanctioned', 13000);
    
  if (loanErr) {
    console.error('Error fetching loans:', loanErr);
    return;
  }
  
  if (!loans || loans.length === 0) {
    console.log('No loans found for 13000.');
    return;
  }
  
  console.log(`Found ${loans.length} loans. Processing...`);
  const loanIds = loans.map(l => l.id);
  
  const { data: schedules, error: schedErr } = await supabase
    .from('collection_schedules')
    .select('*')
    .in('loan_id', loanIds);
    
  if (schedErr) {
    console.error('Error fetching schedules:', schedErr);
    return;
  }
  
  console.log(`Found ${schedules.length} schedules. Updating amounts based on week number...`);
  
  let updateCount = 0;
  
  for (const schedule of schedules) {
    const week = schedule.week_number;
    const newAmount = getAmountForWeek(week);
    
    if (newAmount > 0 && schedule.amount !== newAmount) {
      const { error: updateErr } = await supabase
        .from('collection_schedules')
        .update({ amount: newAmount })
        .eq('id', schedule.id);
        
      if (updateErr) {
        console.error(`Error updating schedule ${schedule.id}:`, updateErr);
      } else {
        updateCount++;
        console.log(`Updated schedule ${schedule.id} (Loan: ${schedule.loan_id}, Week: ${week}) amount to ${newAmount}`);
      }
    }
  }
  
  console.log(`\nDone. Successfully updated ${updateCount} schedules.`);
}

fix13000Schedules();
