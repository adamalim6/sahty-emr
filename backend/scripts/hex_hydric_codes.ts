import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT id, code, encode(convert_to(code, 'UTF8'), 'hex') as hex_code FROM reference.observation_parameters 
        WHERE code ILIKE '%HYDRIC_INPUT%' OR code ILIKE '%HYDRIC_OUTPUT%'
    `);
    console.log("Hex Codes:", paramsRes.rows);
    process.exit(0);
}
run();
