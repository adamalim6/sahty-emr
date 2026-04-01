import { tenantQuery } from './db/tenantPg';
import { globalQuery } from './db/globalPg';
import { emrService } from './services/emrService';

async function run() {
    const tenants = await globalQuery('SELECT id FROM tenants LIMIT 1', []);
    const tId = tenants[0].id;
    console.log("Using Tenant:", tId);

    // 1. Check current admissions state after migration cleanup
    console.log('\n=== 1. CURRENT ADMISSIONS (post-cleanup) ===');
    const admissions = await tenantQuery(tId, `
        SELECT id, tenant_patient_id, admission_type, status, auto_close_at
        FROM admissions ORDER BY admission_date DESC
    `, []);
    admissions.forEach((a: any) => console.log(`  ${a.id} | type=${a.admission_type} | status=${a.status} | auto_close=${a.auto_close_at || 'N/A'}`));

    // 2. Test admission resolution for the patient who has admissions
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087'; // from our biology tests
    console.log(`\n=== 2. RESOLVE ADMISSION for patient ${patientId} ===`);
    
    // Check what admissions this patient has
    const patientAdmissions = await tenantQuery(tId, `
        SELECT id, admission_type, status
        FROM admissions
        WHERE tenant_patient_id = $1 AND status = 'En cours'
        ORDER BY admission_date DESC
    `, [patientId]);
    console.log("Active admissions:", patientAdmissions.length);
    patientAdmissions.forEach((a: any) => console.log(`  ${a.id} | type=${a.admission_type}`));

    const resolvedId = await emrService.resolveOrCreateAdmissionForPrescription(tId, patientId);
    console.log("Resolved admission ID:", resolvedId);

    // Check if it was auto-created or an existing one
    const resolvedRow = await tenantQuery(tId, `
        SELECT id, admission_type, admission_number, auto_close_at
        FROM admissions WHERE id = $1
    `, [resolvedId]);
    console.log("Resolved admission:", resolvedRow[0]);

    // 3. Test with a patient that has NO admissions (simulate)
    console.log('\n=== 3. RESOLVE ADMISSION for non-admitted patient ===');
    // Use a patient_id that exists but has no admissions
    const allPatients = await tenantQuery(tId, `
        SELECT pt.tenant_patient_id
        FROM patients_tenant pt
        WHERE NOT EXISTS (
            SELECT 1 FROM admissions a 
            WHERE a.tenant_patient_id = pt.tenant_patient_id 
            AND a.status = 'En cours'
            AND (a.admission_type IS NULL OR a.admission_type != 'LAB_WALKIN')
        )
        LIMIT 1
    `, []);
    
    if (allPatients.length > 0) {
        const noAdmPt = allPatients[0].tenant_patient_id;
        console.log("Patient with no eligible admissions:", noAdmPt);
        const autoId = await emrService.resolveOrCreateAdmissionForPrescription(tId, noAdmPt);
        console.log("Auto-created admission ID:", autoId);
        const autoRow = await tenantQuery(tId, `
            SELECT id, admission_type, admission_number, auto_close_at
            FROM admissions WHERE id = $1
        `, [autoId]);
        console.log("Auto-created admission:", autoRow[0]);
    } else {
        console.log("No patients without admissions to test.");
    }

    // 4. Verify uniqueness constraint works
    console.log('\n=== 4. UNIQUENESS CONSTRAINT CHECK ===');
    const uniqueIndex = await tenantQuery(tId, `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'admissions' AND indexname = 'idx_unique_active_admission_per_type'
    `, []);
    console.log("Unique index exists:", uniqueIndex.length > 0);
    if (uniqueIndex.length > 0) console.log("  Definition:", uniqueIndex[0].indexdef);

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
