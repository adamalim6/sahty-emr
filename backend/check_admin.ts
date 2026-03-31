import { getTenantPool } from './db/tenantPg';
import { prescriptionService } from './services/prescriptionService';

async function test() {
    console.log("Starting test...");
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res = await pool.query("SELECT pe.id FROM prescription_events pe JOIN prescriptions p ON p.id = pe.prescription_id WHERE p.tenant_patient_id = 'a720c03a-f492-46e6-ae4d-14f639392087' LIMIT 1");
    const peId = res.rows[0].id;
    console.log('Testing PE:', peId);
    try {
        await prescriptionService.logAdministrationAction('ced91ced-fe46-45d1-8ead-b5d51bad5895', peId, 'administered', {
            volume_administered_ml: 200,
            occurredAt: new Date(),
            actualStartAt: new Date(),
            actualEndAt: new Date(),
            performedByUserId: 'cd689408-251f-4ea2-8069-b14cf6eb0377'
        });
        console.log('Success!');
    } catch(e: any) {
        console.error('CAUGHT 500 ERROR:');
        console.error(e);
    }
    await pool.end();
}
test().catch(e => { console.error('FATAL:', e); });
