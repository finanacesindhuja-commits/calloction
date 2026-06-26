require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updateValarmathi() {
  const { error } = await supabase
    .from('collection_schedules')
    .update({ status: 'Received', collected_amount: 1100, approved_at: new Date().toISOString() })
    .in('id', [389, 390, 391]);
    
  if (error) {
    console.error(error);
  } else {
    console.log('Valarmathi D early bills updated successfully.');
  }
}

updateValarmathi();
