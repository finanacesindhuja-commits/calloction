require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanStatuses() {
  console.log('--- Checking all schedule statuses ---');
  const { data: schedules, error } = await supabase
    .from('collection_schedules')
    .select('id, status');

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  const dirtySchedules = [];
  for (const s of schedules) {
    if (s.status && (s.status.includes('\r') || s.status.includes('\n') || s.status.trim() !== s.status)) {
      dirtySchedules.push(s);
    }
  }

  console.log(`Found ${dirtySchedules.length} schedules with dirty status values.`);

  if (dirtySchedules.length > 0) {
    console.log('Sample dirty values:', dirtySchedules.slice(0, 10));
    
    let updatedCount = 0;
    for (const ds of dirtySchedules) {
      const cleanVal = ds.status.trim();
      const { error: updateErr } = await supabase
        .from('collection_schedules')
        .update({ status: cleanVal })
        .eq('id', ds.id);

      if (!updateErr) {
        updatedCount++;
      } else {
        console.error(`Failed to update ID ${ds.id}:`, updateErr);
      }
    }
    console.log(`Successfully updated/cleaned ${updatedCount} schedules.`);
  }
}

cleanStatuses();
