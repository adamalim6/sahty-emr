import { hydricEngineService } from '../services/hydricEngineService';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';
    
    console.log(`Rebuilding full Hydric Ledger for patient: ${patientId}`);
    try {
        await hydricEngineService.rebuildHydricBucketsForPatient(tenantId, patientId);
        console.log("SUCCESS: Engine completely rebuilt the ledger.");
    } catch(e: any) {
        console.error("FAIL:", e.message);
    } finally {
        process.exit(0);
    }
}
run();
