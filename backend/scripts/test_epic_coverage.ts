import { patientTenantService } from '../services/patientTenantService';
import { emrService } from '../services/emrService';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

// Mock tenant ID (replace with actual dev tenant ID if known, or fetch dynamically)
const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; 

async function runTest() {
    console.log("🚀 Starting Epic Coverage Logic Verification...");

    try {
        // 1. Create Patient with Master Coverage
        console.log("\n1. Creating Patient with Master Coverage...");
        const patientId = await patientTenantService.createTenantPatient(TENANT_ID, {
            firstName: 'Jean',
            lastName: 'EpicTest',
            dob: '1980-01-01',
            sex: 'M',
            identifiers: [
                { typeCode: 'CIN', value: `CIN-${uuidv4().substring(0, 8)}`, issuingCountryCode: 'MAR' }
            ],
            coverages: [
                {
                    insuranceOrgId: 'bc2a729c-dc3f-4855-8647-43d2f4d7f923', // Real ID from DB
                    policyNumber: `POL-${uuidv4().substring(0, 8)}`,
                    relationshipToSubscriberCode: 'SELF',
                    subscriber: {
                         firstName: 'Jean',
                         lastName: 'EpicTest'
                    }
                }
            ]
        });
        console.log(`✅ Patient Created: ${patientId}`);

        // 2. Fetch Master Coverage ID
        const coverages = await patientTenantService.searchCoverages(TENANT_ID, 'bc2a729c-dc3f-4855-8647-43d2f4d7f923', ''); // Fuzzy search might fail if exact match not implemented
        // Actually, let's query DB directly to be sure
        const covRows = await tenantQuery(TENANT_ID, `
            SELECT coverage_id, policy_number FROM coverages 
            WHERE tenant_id = $1 AND policy_number LIKE 'POL-%' 
            ORDER BY created_at DESC LIMIT 1
        `, [TENANT_ID]);
        
        if (covRows.length === 0) throw new Error("Coverage creation failed");
        const masterCoverageId = covRows[0].coverage_id;
        const policyNum = covRows[0].policy_number;
        console.log(`✅ Master Coverage Found: ${masterCoverageId} (${policyNum})`);

        // 3. Create Admission with Coverage Snapshot
        console.log("\n2. Creating Admission with Coverage Snapshot...");
        const admission = await emrService.createAdmission(TENANT_ID, {
            tenantPatientId: patientId,
            admissionDate: new Date().toISOString(),
            reason: 'Coverage Test',
            // @ts-ignore - passing coverages in payload for snapshot trigger
            coverages: [
                { coverageId: masterCoverageId, filingOrder: 1 }
            ]
        });
        console.log(`✅ Admission Created: ${admission.id}`);

        // 4. Verify Snapshot
        console.log("\n3. Verifying Snapshot Existence...");
        const snapRes = await tenantQuery(TENANT_ID, `
            SELECT * FROM admission_coverages WHERE admission_id = $1
        `, [admission.id]);

        if (snapRes.length === 0) throw new Error("❌ Snapshot NOT created!");
        const snapshot = snapRes[0];
        console.log(`✅ Snapshot Found: ${snapshot.admission_coverage_id}`);
        console.log(`   - Policy Frozen: ${snapshot.policy_number}`);
        console.log(`   - Plan Frozen: ${snapshot.plan_name}`);

        if (snapshot.policy_number !== policyNum) throw new Error("❌ Policy Number mismatch in snapshot");

        // 5. Verify Decoupling (Modify Master, Check Snapshot)
        console.log("\n4. Verifying Decoupling (Modifying Master)...");
        await tenantQuery(TENANT_ID, `
            UPDATE coverages SET policy_number = 'MODIFIED-POL' WHERE coverage_id = $1
        `, [masterCoverageId]);
        console.log("   - Master Coverage Updated to 'MODIFIED-POL'");

        const snapCheck = await tenantQuery(TENANT_ID, `
            SELECT policy_number FROM admission_coverages WHERE admission_coverage_id = $1
        `, [snapshot.admission_coverage_id]);
        
        if (snapCheck[0].policy_number === 'MODIFIED-POL') {
             throw new Error("❌ FAIL: Snapshot was updated when Master changed! Decoupling failed.");
        }
        console.log(`✅ SUCCESS: Snapshot maintained original value: ${snapCheck[0].policy_number}`);

        console.log("\n🎉 Epic Coverage Logic Verified Successfully!");
        process.exit(0);

    } catch (e: any) {
        console.error("\n❌ TEST FAILED:", e);
        process.exit(1);
    }
}

runTest();
