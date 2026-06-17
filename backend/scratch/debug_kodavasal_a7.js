require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugCenter22() {
  const centerId = 22;
  console.log(`\n--- Fetching Center Info for ID ${centerId} ---`);
  const { data: center, error: centerErr } = await supabase
    .from('centers')
    .select('*')
    .eq('id', centerId)
    .single();

  if (centerErr) {
    console.error('Error fetching center:', centerErr);
    return;
  }
  console.log(center);

  console.log('\n--- Fetching Active/Disbursed Loans for Center ID:', centerId);
  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('id, member_name, amount_sanctioned, status, loan_app_id')
    .eq('center_id', centerId);

  if (loanErr) {
    console.error('Error fetching loans:', loanErr);
  } else {
    console.log(`Found ${loans.length} loans:`);
    console.table(loans);
  }

  console.log('\n--- Fetching Collection Schedules (Bills) for Center ID:', centerId);
  const { data: schedules, error: schErr } = await supabase
    .from('collection_schedules')
    .select('id, member_id, member_name, loan_id, amount, collected_amount, scheduled_date, status, week_number')
    .eq('center_id', centerId)
    .order('scheduled_date', { ascending: true });

  if (schErr) {
    console.error('Error fetching schedules:', schErr);
  } else {
    console.log(`Found ${schedules.length} schedules in collection_schedules:`);
    if (schedules.length > 0) {
      console.table(schedules);
      
      const statusCounts = schedules.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      console.log('\nSchedule Status counts:', statusCounts);

      // Check dates
      const dates = [...new Set(schedules.map(s => s.scheduled_date))];
      console.log('Scheduled dates present:', dates);
    } else {
      console.log('WARNING: No schedules found for this center!');
    }
  }
}

debugCenter22();
