require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDetails() {
  console.log("Checking collection_schedules for values near 2160...");
  
  const { data, error } = await supabase
    .from('collection_schedules')
    .select('*');

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log(`Total schedules: ${data.length}`);
  
  // Find any schedules with collected_amount or amount equal to 2160
  const exactMatches = data.filter(s => s.collected_amount == 2160 || s.amount == 2160);
  console.log(`Exact matches for 2160: ${exactMatches.length}`);
  exactMatches.forEach(m => {
    console.log('Exact match:', m);
  });

  // Find any schedules with collected_amount or amount between 2100 and 2200
  const rangeMatches = data.filter(s => 
    (s.collected_amount >= 2100 && s.collected_amount <= 2200) || 
    (s.amount >= 2100 && s.amount <= 2200)
  );
  console.log(`Range matches (2100-2200): ${rangeMatches.length}`);
  rangeMatches.forEach(m => {
    console.log(`ID: ${m.id}, Member: ${m.member_name}, Scheduled Date: ${m.scheduled_date}, Center ID: ${m.center_id}, Amount: ${m.amount}, Collected: ${m.collected_amount}, Status: ${m.status}`);
  });
}

checkDetails();
