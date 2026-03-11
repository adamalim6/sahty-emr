import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'administration_events'
    `);
    console.log("administration_events columns:", res.rows.map(r => r.column_name));

    const res2 = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'prescription_events'
    `);
    console.log("prescription_events columns:", res2.rows.map(r => r.column_name));
    process.exit(0);
}
run();
