import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking surveillance_hour_buckets schema...");
    try {
        const transRes = await pool.query(`
                SELECT *
                FROM surveillance_hour_buckets
                WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d'
                  AND bucket_start >= '2026-03-08T00:00:00Z'
                ORDER BY bucket_start ASC
                LIMIT 10
        `);
        console.log(JSON.stringify(transRes.rows, null, 2));
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}
run();
