require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStaff() {
  const { data, error } = await supabase.from('staff').select('*');
  if (error) {
    console.error('Error fetching staff:', error);
  } else {
    console.log(`Found ${data.length} staff members:`);
    data.forEach(s => {
      console.log(`ID: ${s.id}, Staff ID: ${s.staff_id}, Name: ${s.name}, Role: ${s.role}`);
    });
  }
}

checkStaff();
