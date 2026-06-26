require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
  const { data: counts, error } = await supabase
    .from('collection_schedules')
    .select('status', { count: 'exact' });
  
  if (error) console.error(error);
  
  const statusMap = {};
  if (counts) {
    for (let c of counts) {
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
    }
  }
  console.log('Status counts:', statusMap);
}

checkStatus();
