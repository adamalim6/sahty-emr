import { Pool } from 'pg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: `tenant_${tenantId}` });
    try {
        const res = await pool.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'update_surveillance_hour_bucket'
        `);
        console.log("Trigger source code:", res.rows[0]?.prosrc);
    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
