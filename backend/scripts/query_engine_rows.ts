import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res = await pool.query(`
        SELECT id, bucket_start, parameter_code, value_numeric, recorded_by
        FROM surveillance_values_events
        WHERE parameter_code IN ('HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
    `);
    console.log("Calculated Engine Rows:", res.rows);
    process.exit(0);
}
run();
