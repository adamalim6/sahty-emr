import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT id, code, is_hydric_input, is_hydric_output, source 
        FROM reference.observation_parameters 
        WHERE code IN ('APPORTS_HYD_CR_MAN', 'PERTES_HYD_CR_MAN', 'HYDRIC_INPUT', 'HYDRIC_OUTPUT')
    `);
    console.log("Flags:", paramsRes.rows);
    process.exit(0);
}
run();
