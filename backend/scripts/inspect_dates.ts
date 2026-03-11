import { getTenantPool } from '../db/tenantPg';

async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    
    console.log("Checking actual dates of Transfusion event...");
    try {
        const transRes = await pool.query(`
                SELECT id, occurred_at, actual_start_at, actual_end_at, action_type
                FROM administration_events
                WHERE id = 'dd305332-4839-4252-aed6-907ef4de717a'
        `);
        console.table(transRes.rows);
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}
run();
