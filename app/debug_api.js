
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pmpkffexnqrcfauyjemk.supabase.co';
const supabaseKey = 'sb_publishable_z6y903NHQTmeI0e0ksqAFA_Z3mUFU9B';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- Fetching a customer ---');
  const { data: customers, error: cError } = await supabase.from('customers').select('customer_id').limit(1);
  if (cError) {
    console.error('Customer fetch error:', cError);
    process.exit(1);
  }
  if (!customers || !customers.length) {
    console.log('No customers found.');
    process.exit(1);
  }
  const cid = customers[0].customer_id;
  console.log('Using customer_id:', cid);

  console.log('--- Test 1: Empty string pricing ---');
  const { error: err1 } = await supabase.from('projects').insert({
    name: 'Test Project 1',
    customer_id: cid,
    pricing: '' 
  });
  console.log('Result 1 (Pricing: ""):', err1 ? `FAIL: ${err1.message} (${err1.code})` : 'SUCCESS');

  console.log('--- Test 2: Missing customer_id ---');
  const { error: err2 } = await supabase.from('projects').insert({
    name: 'Test Project 2'
  });
  console.log('Result 2 (No CID):', err2 ? `FAIL: ${err2.message} (${err2.code})` : 'SUCCESS');

  console.log('--- Test 3: Null pricing ---');
  const { error: err3 } = await supabase.from('projects').insert({
    name: 'Test Project 3',
    customer_id: cid,
    pricing: null
  });
  console.log('Result 3 (Pricing: null):', err3 ? `FAIL: ${err3.message} (${err3.code})` : 'SUCCESS');
}

debug();
