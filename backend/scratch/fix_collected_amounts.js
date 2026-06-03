require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixCollectedAmounts() {
  const { data: bills, error } = await supabase
    .from('collection_schedules')
    .select('id, amount, collected_amount')
    .eq('status', 'Paid');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const weirdBills = bills.filter(b => b.collected_amount !== b.amount);
  console.log(`Found ${weirdBills.length} Paid bills with mismatched collected_amount. Fixing them...`);
  
  let fixedCount = 0;
  for (const bill of weirdBills) {
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({ collected_amount: bill.amount })
      .eq('id', bill.id);
      
    if (updateError) {
      console.error(`Error updating bill ${bill.id}:`, updateError);
    } else {
      fixedCount++;
    }
  }

  console.log(`Fixed ${fixedCount} out of ${weirdBills.length} bills.`);
}

fixCollectedAmounts();
