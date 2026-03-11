import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking surveillance_value_events HYDRIC_INPUT for test patient...");
    try {
        const transRes = await pool.query(`
                SELECT bucket_start, parameter_code, value_numeric, recorded_by
                FROM surveillance_values_events
                WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
                  AND parameter_code = 'HYDRIC_INPUT'
                  AND bucket_start > '2026-03-08T01:00:00Z'
        `);
        console.table(transRes.rows);
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}
run();
