import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking blood bags...");
    const res = await pool.query(`
            SELECT * FROM administration_event_blood_bags
            WHERE administration_event_id IN ('dd305332-4839-4252-aed6-907ef4de717a', '99fa387c-7106-4e3f-888a-222a51065f92')
    `);
    console.table(res.rows);

    process.exit(0);
}
run();
