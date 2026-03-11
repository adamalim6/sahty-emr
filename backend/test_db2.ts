import { getTenantPool } from './db/tenantPg';
async function run() {
  const pool = getTenantPool('adamalim6');
  const { rows } = await pool.query(`SELECT id, action_type, status, linked_event_id, occurred_at FROM administration_events WHERE action_type IN ('started', 'ended') ORDER BY created_at DESC LIMIT 10`);
  console.log(rows);
  process.exit(0);
}
run();
