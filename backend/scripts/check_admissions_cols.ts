import { getTenantPool } from '../db/tenantPg';
async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    console.log("Checking columns of admissions table...");
    const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'admissions'
    `);
    console.log("Columns:", res.rows.map(r => r.column_name));

    process.exit(0);
}
run();
