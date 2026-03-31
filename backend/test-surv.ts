import { surveillanceService } from './services/surveillanceService';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const tenantId = 'cf64ecc6_0be4_4571_b9ea_f460114d0b27';
        // Need to grab a valid patient ID. So let's just grab the first UUID from the db.
        const { getTenantPool } = require('./db/tenantPg');
        const pool = getTenantPool(tenantId);
        
        const ptRes = await pool.query('SELECT tenant_patient_id FROM prescriptions LIMIT 1');
        if (ptRes.rows.length === 0) {
            console.log("No prescriptions found.");
            return;
        }
        const patientId = ptRes.rows[0].tenant_patient_id;
        
        console.log("Fetching timeline for:", patientId);
        const fromDate = new Date(Date.now() - 3600000 * 24).toISOString();
        const toDate = new Date(Date.now() + 3600000 * 24).toISOString();
        
        const data = await surveillanceService.getTimeline(tenantId, patientId, fromDate, toDate);
        console.log("Timeline events count:", data.timelineEvents.length);
        if (data.timelineEvents.length > 0) {
            console.log(data.timelineEvents[0]);
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
