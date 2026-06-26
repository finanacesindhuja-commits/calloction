require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateSumathi2Weeks() {
  // First 2 weeks: 883 (29/05/2026) and 884 (05/06/2026)
  const { error } = await supabase
    .from('collection_schedules')
    .update({ 
      status: 'Received', 
      collected_amount: 1050, 
      approved_at: new Date().toISOString() 
    })
    .in('id', [883, 884]);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sumathi first 2 weeks updated to Received successfully.');
    console.log('  883: 2026-05-29 - ₹1050 -> Received');
    console.log('  884: 2026-06-05 - ₹1050 -> Received');
  }
}

updateSumathi2Weeks();
