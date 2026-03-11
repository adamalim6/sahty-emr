import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT id, code FROM reference.observation_parameters 
        WHERE code IN ('HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
    `);
    console.log("Found codes:", paramsRes.rows.map(r => r.code));
    process.exit(0);
}
run();
