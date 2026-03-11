import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    // Query 1: IN operator
    const res1 = await pool.query(`
        SELECT id, code FROM reference.observation_parameters 
        WHERE code IN ('HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
    `);
    console.log("IN operator:", res1.rows);

    // Query 2: Exact match equality
    const res2 = await pool.query(`
        SELECT id, code FROM reference.observation_parameters 
        WHERE code = 'HYDRIC_INPUT'
    `);
    console.log("= operator:", res2.rows);

    // Query 3: ILIKE
    const res3 = await pool.query(`
        SELECT id, code FROM reference.observation_parameters 
        WHERE code ILIKE 'HYDRIC_INPUT'
    `);
    console.log("ILIKE operator:", res3.rows);

    process.exit(0);
}
run();
