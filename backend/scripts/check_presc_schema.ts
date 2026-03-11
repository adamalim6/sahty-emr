import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'prescriptions'
    `);
    console.log("prescriptions columns:", res.rows.map(r => r.column_name));
    process.exit(0);
}
run();
