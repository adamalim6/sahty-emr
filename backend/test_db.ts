import { getTenantPool } from './db/tenantPg';
async function run() {
  const pool = getTenantPool('adamalim6');
  const { rows } = await pool.query(`SELECT id, action_type, status, linked_event_id, occurred_at FROM administration_events ORDER BY created_at DESC LIMIT 10`);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
