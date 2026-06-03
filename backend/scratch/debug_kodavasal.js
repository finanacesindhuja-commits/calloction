require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugCenter() {
  console.log('Searching for center containing "kodavasal" and "a4"...');
  
  const { data: centers, error: centerErr } = await supabase
    .from('centers')
    .select('*')
    .ilike('name', '%kodavasal%');

  if (centerErr) {
    console.error('Error fetching centers:', centerErr);
    return;
  }

  const targetCenter = centers.find(c => c.name.toLowerCase().includes('a4') || c.name.toLowerCase().includes('kodavasal a4'));
  
  if (!targetCenter) {
    console.log('Center not found! Here are the centers matching "kodavasal":');
    console.log(centers.map(c => ({ id: c.id, name: c.name })));
    return;
  }

  console.log('Found center:', targetCenter.name, '(ID:', targetCenter.id, ')');

  // Fetch loans for this center
  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('id, member_name, amount_sanctioned, status')
    .eq('center_id', targetCenter.id);

  console.log(`\nFound ${loans?.length || 0} loans for this center.`);

  // Fetch bills (schedules) for this center
  const { data: schedules, error: schErr } = await supabase
    .from('collection_schedules')
    .select('*')
    .eq('center_id', targetCenter.id)
    .order('scheduled_date', { ascending: true });

  console.log(`Found ${schedules?.length || 0} bills for this center.`);
  
  if (schedules && schedules.length > 0) {
    console.log('\nSample bills (first 5):');
    console.log(schedules.slice(0, 5).map(s => ({
      id: s.id,
      member_name: s.member_name,
      amount: s.amount,
      scheduled_date: s.scheduled_date,
      status: s.status,
      loan_id: s.loan_id
    })));

    // Group by status
    const statusCounts = schedules.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    console.log('\nBill Status Summary:', statusCounts);
  }
}

debugCenter();
