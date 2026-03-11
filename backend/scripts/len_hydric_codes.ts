import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT id, code, LENGTH(code) as len FROM reference.observation_parameters 
        WHERE code ILIKE '%HYDRIC%'
    `);
    console.log("Codes:", paramsRes.rows);
    process.exit(0);
}
run();
