import { hydricEngineService } from '../services/hydricEngineService';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    
    const eventRes = await pool.query(`SELECT tenant_patient_id FROM prescription_events LIMIT 1`);
    if(eventRes.rows.length === 0) process.exit(0);
    const pId = eventRes.rows[0].tenant_patient_id;

    console.log("Triggering engine for patient:", pId);
    try {
        await hydricEngineService.rebuildHydricBucketsForPatient(tenantId, pId);
        console.log("Rebuild completed successfully without throwing exceptions.");
    } catch(e: any) {
        console.error("ENGINE ERROR:", e.message);
    }
    process.exit(0);
}
run();
