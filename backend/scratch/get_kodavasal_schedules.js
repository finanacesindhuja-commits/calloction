require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getKodavasalSchedules() {
  const { data: schedules, error } = await supabase
    .from('collection_schedules')
    .select('*')
    .eq('center_id', 6)
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log(`Total schedules for Kodavasal A4 (Center ID 6): ${schedules.length}`);
  schedules.forEach(s => {
    console.log(`ID: ${s.id}, Member: ${s.member_name}, Scheduled Date: ${s.scheduled_date}, Amount: ${s.amount}, Collected: ${s.collected_amount}, Status: ${s.status}`);
  });
}

getKodavasalSchedules();
