import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res = await pool.query(`
        SELECT column_name, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'administration_events'
        AND column_name = 'tenant_patient_id'
    `);
    console.log("is_nullable:", res.rows[0]?.is_nullable);
    process.exit(0);
}
run();
