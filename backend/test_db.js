const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://sahty:sahty_pwd@localhost:5432/sahty_tenant_adamalim6' });

async function run() {
  const { rows } = await pool.query(`SELECT id, action_type, status, linked_event_id, volume_administered_ml, occurred_at FROM administration_events ORDER BY created_at DESC LIMIT 10`);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
