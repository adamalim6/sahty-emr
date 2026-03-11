import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking all blood bags in administration_event_blood_bags...");
    const res = await pool.query(`
            SELECT aeb.*, ae.occurred_at, ae.action_type
            FROM administration_event_blood_bags aeb
            JOIN administration_events ae ON ae.id = aeb.administration_event_id
            ORDER BY ae.occurred_at DESC
            LIMIT 10
    `);
    console.table(res.rows);

    process.exit(0);
}
run();
