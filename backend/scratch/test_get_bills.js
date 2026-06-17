require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testGetBills() {
  const centerId = 22;
  try {
    console.log('--- Fetching schedules ---');
    const { data: rawSchedules, error: schError } = await supabase
      .from('collection_schedules')
      .select('*')
      .eq('center_id', centerId)
      .order('scheduled_date', { ascending: true });

    if (schError) throw schError;
    console.log(`Schedules found: ${rawSchedules?.length}`);

    console.log('--- Fetching members ---');
    const { data: members, error: memError } = await supabase
      .from('loans')
      .select('member_name, id, amount_sanctioned, loan_app_id, member_photo_url, members(member_no)')
      .eq('center_id', centerId)
      .in('status', ['DISBURSED', 'ACTIVE', 'CREDITED', 'SANCTIONED', 'ARCHIVED']);

    if (memError) {
      console.error('memError details:', memError);
      throw memError;
    }
    console.log(`Members found: ${members?.length}`);
    console.log(JSON.stringify(members, null, 2));

  } catch (err) {
    console.error('Error occurred in testGetBills:', err);
  }
}

testGetBills();
