const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: schedules, error: schError } = await supabase
    .from('collection_schedules')
    .select('member_name');
    
  if (schError) throw schError;
  
  const names = [...new Set(schedules.map(s => s.member_name))];
  console.log('All unique names:', JSON.stringify(names, null, 2));
}

check().catch(console.error);
