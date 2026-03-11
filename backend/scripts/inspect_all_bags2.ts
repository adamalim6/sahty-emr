import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking latest administration_events with blood bags...");
    const res = await pool.query(`
            SELECT ae.id, ae.status, ae.action_type, ae.linked_event_id, b.volume_administered_ml
            FROM administration_event_blood_bags b
            JOIN administration_events ae ON ae.id = b.administration_event_id
            ORDER BY ae.occurred_at DESC
            LIMIT 5
    `);
    console.table(res.rows);

    process.exit(0);
}
run();
