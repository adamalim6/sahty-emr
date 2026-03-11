import { prescriptionService } from '../services/prescriptionService';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; // Admin tenant from the URL
    const pool = getTenantPool(tenantId);
    
    // Get a valid prescription event
    const res = await pool.query(`SELECT id FROM prescription_events LIMIT 1`);
    if (res.rows.length === 0) {
        console.log("No prescription events found.");
        process.exit(0);
    }
    const eventId = res.rows[0].id;
    console.log("Testing with prescription event:", eventId);

    try {
        await prescriptionService.logAdministrationAction(tenantId, eventId, 'administered', {
            volume_administered_ml: 100
        });
        console.log("Success!");
    } catch (e: any) {
        console.error("ERROR CAUGHT:");
        console.error(e.message);
        console.error(e.stack);
    }
    process.exit(0);
}
run();
