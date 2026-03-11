import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    console.log("Checking admissions tables...");
    const res = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name ILIKE '%admission%'
    `);
    console.log("Tables:", res.rows);

    process.exit(0);
}
run();
