import { surveillanceService } from '../services/surveillanceService';
import { getTenantPool } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = '2a96aac3-9cdb-4912-bb55-2bb3fec17805';
    const paramId = '995df62d-4083-4f19-8136-6d0a730b181b'; 
    const paramCode = 'APPORTS_HYD_CR_MAN';
    const userId = 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a0';

    console.log("Mocking UI input for APPORTS_HYD_CR_MAN = 500");
    const dIso = new Date().toISOString();

    try {
        await surveillanceService.updateCell(
            tenantId, 
            patientId, 
            dIso, // recordedAt
            paramId, 
            paramCode, 
            500, // value
            userId
        );
        
        console.log("Success! Checking DB...");
        const pool = getTenantPool(tenantId);
        const res = await pool.query(`
            SELECT parameter_code, value_numeric, bucket_start 
            FROM surveillance_values_events 
            WHERE tenant_patient_id = $1
            ORDER BY recorded_at DESC LIMIT 5
        `, [patientId]);
        console.log("Recent rows in DB:", res.rows);

    } catch (e: any) {
        console.error("FAIL:", e.message);
    }
    process.exit(0);
}
run();
