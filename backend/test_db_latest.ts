import { Pool } from 'pg';
async function run() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'sahty',
    password: 'sahty_dev_2026',
    database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
  });
  try {
    const { rows } = await pool.query(`SELECT id, action_type, status, volume_administered_ml, occurred_at FROM administration_events ORDER BY created_at DESC LIMIT 5`);
    console.log("LAST 5 EVENTS:");
    console.log(JSON.stringify(rows, null, 2));

    const { rows: buckets } = await pool.query(`SELECT * FROM surveillance_hour_buckets WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d' ORDER BY bucket_start DESC LIMIT 3`);
    console.log("LAST 3 BUCKETS:");
    console.log(JSON.stringify(buckets, null, 2));

    const { rows: events } = await pool.query(`SELECT * FROM surveillance_values_events WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d' AND parameter_code = 'HYDRIC_INPUT' ORDER BY recorded_at DESC LIMIT 3`);
    console.log("LAST 3 VALUES EVENTS:");
    console.log(JSON.stringify(events, null, 2));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
