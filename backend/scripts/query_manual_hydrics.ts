import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    // First let's get any manual hydric entries for the whole day to see what exists
    console.log("Querying all manual hydrics...");
    const res = await pool.query(`
        SELECT e.tenant_patient_id, e.bucket_start, e.value_numeric, p.code, p.is_hydric_input, p.is_hydric_output
        FROM surveillance_values_events e
        JOIN reference.observation_parameters p ON e.parameter_id = p.id
        WHERE p.source = 'manual'
          AND (p.is_hydric_input = true OR p.is_hydric_output = true)
    `);
    console.log("All matching rows:", res.rows);

    process.exit(0);
}
run();
