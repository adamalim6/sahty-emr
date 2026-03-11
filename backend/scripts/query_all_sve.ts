import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    console.log("Querying all events blind...");
    const res = await pool.query(`
        SELECT e.parameter_code, e.value_numeric, e.recorded_by, e.tenant_patient_id
        FROM surveillance_values_events e
    `);
    console.log("All rows in SVE:", res.rows);

    process.exit(0);
}
run();
