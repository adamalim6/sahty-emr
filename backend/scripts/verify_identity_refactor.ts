
import { patientTenantService } from '../services/patientTenantService';
import { CreateTenantPatientPayload } from '../models/patientTenant';
import { Pool } from 'pg';
import { getTenantDbName } from '../db/tenantPg';

const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001'; // Same as simulate
const DB_NAME = getTenantDbName(TEST_TENANT_ID);

async function runVerification() {
    console.log(`\n🕵️  VERIFYING IDENTITY REFACTOR (Tenant: ${TEST_TENANT_ID}) 🕵️\n`);

    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: DB_NAME
    });

    try {
        // 1. Setup Context
        // Ensure tenant DB exists (run simulate_provisioning if needed, but assuming it exists or we can run it)
        // We'll assume simulate_provisioning ran or we run it manually.
        // But to be safe, let's just use the service assuming DB is there.
        // If DB doesn't exist, this will fail. Valid.

        // 2. Prepare Payload
        const payload: CreateTenantPatientPayload = {
            firstName: "Hamid",
            lastName: "Benani",
            dob: "1980-01-01",
            sex: "M",
            status: "VERIFIED",
            identifiers: [
                { typeCode: "CIN", value: "AB" + Date.now(), issuingCountryCode: "MA", isPrimary: true }
            ],
            relationships: [
                {
                    relationshipTypeCode: "FATHER",
                    relatedFirstName: "Ahmed",
                    relatedLastName: "Benani",
                    isEmergencyContact: true,
                    isDecisionMaker: true 
                }
            ],
            coverages: [
                // We need a valid insuranceOrgId. 
                // Let's query one or insert a dummy.
            ]
        };

        // Get an organisme
        const orgRes = await pool.query("SELECT id FROM reference.organismes LIMIT 1");
        if (orgRes.rows.length > 0) {
            payload.coverages = [{
                insuranceOrgId: orgRes.rows[0].id,
                policyNumber: "POL-999",
                relationshipToSubscriberCode: "SELF"
            }];
        } else {
            console.warn("⚠️ No organisms found, skipping coverage test.");
        }

        // 3. Run Create
        console.log("👉 Creating Tenant Patient...");
        const patientId = await patientTenantService.createTenantPatient(TEST_TENANT_ID, payload);
        console.log(`✅ Created Patient ID: ${patientId}`);

        // 4. Verify DB State
        console.log("\n🔎 Verifying DB State...");
        
        // A. Patient Table
        const pat = await pool.query("SELECT * FROM patients_tenant WHERE tenant_patient_id = $1", [patientId]);
        console.log(`   - patients_tenant: ${pat.rows.length === 1 ? '✅' : '❌'}`);
        if(pat.rows.length) console.log(`     Name: ${pat.rows[0].first_name} ${pat.rows[0].last_name}`);

        // B. Identity IDs
        const ids = await pool.query("SELECT * FROM identity_ids WHERE tenant_patient_id = $1", [patientId]);
        console.log(`   - identity_ids: ${ids.rows.length >= 2 ? '✅' : '❌'} (Expected CIN + MRN)`);
        ids.rows.forEach(r => console.log(`     [${r.identity_type_code}] ${r.identity_value} (Primary: ${r.is_primary})`));

        // C. Relationships
        const rels = await pool.query("SELECT * FROM patient_relationship_links WHERE subject_tenant_patient_id = $1", [patientId]);
        console.log(`   - patient_relationship_links: ${rels.rows.length >= 1 ? '✅' : '❌'}`);
        rels.rows.forEach(r => console.log(`     [${r.relationship_type_code}] Related: ${r.related_first_name} ${r.related_last_name}`));

        // D. Coverages
        const covs = await pool.query("SELECT * FROM patient_coverages WHERE tenant_patient_id = $1", [patientId]);
        console.log(`   - patient_coverages: ${covs.rows.length >= 1 ? '✅' : '❌'}`);
        
        // E. Outbox
        const outbox = await pool.query("SELECT * FROM identity_sync.outbox_events WHERE entity_id = $1", [patientId]);
        console.log(`   - outbox_events: ${outbox.rows.length >= 1 ? '✅' : '❌'}`);
        if(outbox.rows.length) console.log(`     Event: ${outbox.rows[0].event_type}`);

        // 5. Verify Service Read
        console.log("\n👉 Verifying Service Read (getTenantPatient)...");
        const readBack = await patientTenantService.getTenantPatient(TEST_TENANT_ID, patientId);
        if (readBack) {
            console.log(`✅ Read Success`);
            console.log(`   MRN: ${readBack.medicalRecordNumber}`);
            console.log(`   Identifiers: ${readBack.identifiers.length}`);
            console.log(`   Relationships: ${readBack.relationships.length}`);
        } else {
            console.error("❌ Read Failed (Returned null)");
        }

    } catch (e: any) {
        console.error("\n❌ VERIFICATION FAILED:", e);
    } finally {
        await pool.end();
    }
}

runVerification();
