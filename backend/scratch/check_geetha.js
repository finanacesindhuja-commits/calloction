require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkGeetha() {
  const { data: bills } = await supabase
    .from('collection_schedules')
    .select('*')
    .eq('member_name', 'Geetha T')
    .order('scheduled_date', { ascending: true });
    
  console.log(bills);
}

checkGeetha();
