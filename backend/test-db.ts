import { Client } from 'pg';

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'tenant_cf64ecc6_0be4_4571_b9ea_f460114d0b27',
  user: 'sahty',
  password: 'sahty_dev_2026',
});

async function run() {
  await client.connect();
  console.log('--- Prescriptions (last 10) ---');
  const res = await client.query(`
    SELECT id, prescription_type as type, status, tenant_patient_id,
           (SELECT count(*) FROM prescription_events pe WHERE pe.prescription_id = p.id) as ev_count
    FROM prescriptions p
    ORDER BY created_at DESC LIMIT 10;
  `);
  console.table(res.rows);

  console.log('--- Prescription Events (last 10) ---');
  const evRes = await client.query(`
    SELECT id, prescription_id, status, scheduled_at, tenant_patient_id 
    FROM prescription_events 
    ORDER BY created_at DESC LIMIT 10;
  `);
  console.table(evRes.rows);
  
  await client.end();
}
run();
