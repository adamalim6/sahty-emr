import { Pool } from 'pg';
const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'sahty_global',
  password: 'sahty',
  port: 5432,
});
async function main() {
    // Find which tenant has this patient
    const res = await pool.query("SELECT * FROM public.global_patients WHERE id = (SELECT global_patient_id FROM public.global_patient_tenants WHERE tenant_patient_id = '2a96aac3-9cdb-4912-bb55-2bb3fec17805' LIMIT 1)");
    console.log("Global Patient:", res.rows);
    const res2 = await pool.query("SELECT tenant_id FROM public.global_patient_tenants WHERE tenant_patient_id = '2a96aac3-9cdb-4912-bb55-2bb3fec17805'");
    console.log("Tenant IDs possessing this patient:", res2.rows);
    pool.end();
}
main();
