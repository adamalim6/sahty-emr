import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_schema = 'reference' AND table_name = 'observation_parameters' AND column_name = 'code'
    `);
    console.log("Column type:", paramsRes.rows);
    process.exit(0);
}
run();
