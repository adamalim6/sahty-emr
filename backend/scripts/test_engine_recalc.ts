import { hydricEngineService } from '../services/hydricEngineService';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    // Use the patient ID from the screenshot: 2a96aac3-9cdb-4912-bb55-2bb3fec17805
    const pId = '2a96aac3-9cdb-4912-bb55-2bb3fec17805';

    console.log("Testing recalculateBuckets directly for today's date.");
    const date = new Date().toISOString();

    try {
        await hydricEngineService.recalculateBuckets(tenantId, pId, date, date);
        console.log("Recalculate complete.");
    } catch(e: any) {
        console.error("ENGINE ERROR:", e.message);
    }
    process.exit(0);
}
run();
