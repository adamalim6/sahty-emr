import { tenantQuery } from '../db/tenantPg';

async function run() {
    const tenantId = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';

    try {
        const query = `
            SELECT id, prescription_type, status, created_at, product_or_service_name
            FROM public.prescriptions 
            WHERE tenant_patient_id = $1
        `;
        const res = await tenantQuery(tenantId, query, [patientId]);
        
        console.log(`Found ${res.length} prescriptions:`);
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
