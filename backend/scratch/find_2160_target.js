require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getPenalty = (scheduledDate, scheduleStatus) => {
  if (scheduleStatus === 'Paid' || scheduleStatus === 'Verified' || scheduleStatus === 'Received') return 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayObj = new Date(todayStr);
  const schedObj = new Date(scheduledDate);
  
  const diffTime = todayObj - schedObj;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays * 20 : 0;
};

async function find2160Target() {
  const selectedDate = new Date().toISOString().split('T')[0]; // today
  console.log(`Using selectedDate = ${selectedDate}`);

  // Fetch all centers, members (loans), and schedules
  const { data: centers } = await supabase.from('centers').select('*');
  const { data: loans } = await supabase.from('loans').select('*').in('status', ['DISBURSED', 'ACTIVE', 'CREDITED', 'SANCTIONED', 'ARCHIVED']);
  const { data: schedules } = await supabase.from('collection_schedules').select('*');

  // For each center
  centers.forEach(center => {
    const centerMembers = loans.filter(l => l.center_id === center.id);
    const centerSchedules = schedules.filter(s => s.center_id === center.id);

    centerMembers.forEach(member => {
      const memberSchedules = centerSchedules.filter(s => 
        (s.loan_id && String(s.loan_id) === String(member.id)) || 
        (s.member_id && String(s.member_id) === String(member.id)) ||
        (s.member_name && member.member_name && s.member_name.trim().toLowerCase() === member.member_name.trim().toLowerCase())
      );

      const matchingSchedules = memberSchedules.filter(s => {
        const sDate = new Date(s.scheduled_date.split('T')[0].split(' ')[0]);
        const selDate = new Date(selectedDate);
        return (s.status === 'Pending' || s.status === 'Approved' || s.status === 'Partial' || s.status === 'Active') && (sDate <= selDate);
      });

      let targetAmount = 0;
      let penaltyAmount = 0;
      matchingSchedules.forEach(s => {
        targetAmount += (Number(s.amount) - (Number(s.collected_amount) || 0));
        const penalty = getPenalty(s.scheduled_date, s.status);
        penaltyAmount += penalty;
      });

      const totalTarget = targetAmount + penaltyAmount;
      if (totalTarget === 2160 || totalTarget === 4320) {
        console.log(`MATCH found!`);
        console.log(`Center: ${center.name} (ID: ${center.id})`);
        console.log(`Member: ${member.member_name} (ID: ${member.id})`);
        console.log(`Total Target: ${totalTarget} (Base target: ${targetAmount}, Penalty: ${penaltyAmount})`);
        console.log(`Matching Schedules:`);
        matchingSchedules.forEach(s => {
          console.log(`  Schedule ID: ${s.id}, Date: ${s.scheduled_date}, Amount: ${s.amount}, Collected: ${s.collected_amount}, Status: ${s.status}, Penalty: ${getPenalty(s.scheduled_date, s.status)}`);
        });
        console.log('------------------------------------');
      }
    });
  });
}

find2160Target();
