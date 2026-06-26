require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeAndFix() {
  console.log('Fetching all collection schedules...');

  const { data: schedules, error } = await supabase
    .from('collection_schedules')
    .select('id, amount, collected_amount, status, scheduled_date, member_name')
    .order('scheduled_date', { ascending: true });

  if (error) { console.error(error); return; }

  console.log(`Total schedules: ${schedules.length}`);

  // Analyze
  const mismatch = schedules.filter(s => 
    (s.status === 'Paid' || s.status === 'Received') &&
    Number(s.collected_amount) !== Number(s.amount)
  );

  const missingCollected = schedules.filter(s =>
    (s.status === 'Paid' || s.status === 'Received') &&
    (!s.collected_amount || Number(s.collected_amount) === 0)
  );

  console.log(`\n--- ANALYSIS ---`);
  console.log(`Paid/Received with WRONG collected_amount: ${mismatch.length}`);
  console.log(`Paid/Received with ZERO/NULL collected_amount: ${missingCollected.length}`);

  if (mismatch.length > 0) {
    console.log('\nSample mismatches:');
    mismatch.slice(0, 10).forEach(s => {
      console.log(`  ID ${s.id}: ${s.member_name} | date: ${s.scheduled_date} | amount: ${s.amount} | collected: ${s.collected_amount} | status: ${s.status}`);
    });
  }

  // Fix: Set collected_amount = amount for all Paid/Received records where they don't match
  const toFix = schedules.filter(s =>
    (s.status === 'Paid' || s.status === 'Received') &&
    Number(s.collected_amount) !== Number(s.amount)
  );

  console.log(`\nFixing ${toFix.length} records...`);
  let fixedCount = 0;

  for (const s of toFix) {
    const { error: updateError } = await supabase
      .from('collection_schedules')
      .update({ collected_amount: s.amount })
      .eq('id', s.id);

    if (updateError) {
      console.error(`Error fixing ID ${s.id}:`, updateError.message);
    } else {
      fixedCount++;
    }
  }

  console.log(`\nSuccessfully fixed ${fixedCount}/${toFix.length} records.`);
  console.log('Done!');
}

analyzeAndFix();
