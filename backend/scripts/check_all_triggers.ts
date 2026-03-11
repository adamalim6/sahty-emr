import { Pool } from 'pg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: `tenant_${tenantId}` });
    try {
        const res = await pool.query(`
            SELECT trigger_name, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE event_object_table IN ('surveillance_values_events', 'surveillance_hour_buckets');
        `);
        console.log("Triggers:", JSON.stringify(res.rows, null, 2));
    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
