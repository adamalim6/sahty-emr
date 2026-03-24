const fs = require('fs');
const { Client } = require('pg');

async function run() {
  // First try sahty_global
  const connectionString = process.env.DATABASE_URL || 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
  console.log('Connecting to:', connectionString);
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to sahty_global');
    const sql = fs.readFileSync('seed_lab_reference_data.sql', 'utf8');
    await client.query(sql);
    console.log('Successfully seeded sahty_global reference tables');
  } catch (err) {
    console.error('Error seeding sahty_global:', err.message);
  } finally {
    await client.end();
  }

  // Now try tenant_adamalim6 because tenant reference mirrors usually need the same data, 
  // or maybe the user has a script that syncs them. Let's just do sahty_global first
  // and then tenant_adamalim6 to be safe.
  
  const tenantString = 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_adamalim6';
  const tenantClient = new Client({ connectionString: tenantString });
  try {
    await tenantClient.connect();
    console.log('Connected to tenant_adamalim6');
    const sql = fs.readFileSync('seed_lab_reference_data.sql', 'utf8');
    await tenantClient.query(sql);
    console.log('Successfully seeded tenant_adamalim6 reference tables');
  } catch (err) {
    console.error('Error seeding tenant_adamalim6:', err.message);
  } finally {
    await tenantClient.end();
  }
}

run();
