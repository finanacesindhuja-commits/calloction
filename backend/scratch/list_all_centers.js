require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listAllCenters() {
  console.log('--- Listing all centers ---');
  const { data: centers, error } = await supabase
    .from('centers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching centers:', error);
    return;
  }

  console.log(`Total centers in database: ${centers.length}`);
  console.table(centers.map(c => ({ id: c.id, name: c.name, staff_id: c.staff_id })));
}

listAllCenters();
