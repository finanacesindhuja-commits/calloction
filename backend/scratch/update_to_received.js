require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateToReceived() {
  console.log(`Updating all Paid bills to Received...`);

  const { data: billsToUpdate, error: fetchError } = await supabase
    .from('collection_schedules')
    .select('id')
    .eq('status', 'Paid');

  if (fetchError) {
    console.error('Error fetching data:', fetchError);
    return;
  }

  console.log(`Found ${billsToUpdate.length} bills to mark as Received.`);
  if (billsToUpdate.length === 0) return;

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const bill of billsToUpdate) {
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({
        status: 'Received'
      })
      .eq('id', bill.id);
    
    if (updateError) {
      console.error(`Error updating bill ${bill.id}:`, updateError);
    } else {
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount}/${billsToUpdate.length} bills to Received.`);
}

updateToReceived();
