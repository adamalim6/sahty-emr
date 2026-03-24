import { getTenantPool } from './db/tenantPg';
async function run() {
  const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
  const res = await pool.query("SELECT id, tenant_patient_id, status FROM prescriptions WHERE status != 'STOPPED'");
  console.log('prescriptions:', res.rows.length);
  const events = await pool.query("SELECT COUNT(*) FROM prescription_events");
  console.log('prescription_events total:', events.rows[0]);
  process.exit(0);
}
run();
