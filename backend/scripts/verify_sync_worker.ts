
import { Pool } from 'pg';
import { patientTenantService } from '../services/patientTenantService';
import { identitySyncService } from '../services/identitySyncService';
import { tenantQuery, getTenantClient } from '../db/tenantPg';
import { identityQuery } from '../db/identityPg';
import { closeGlobalPool } from '../db/globalPg';

// Use same test tenant as before or a fresh one
const TENANT_ID = '00000000-0000-4000-a000-000000000001';

async function runVerification() {
    console.log(`🕵️  VERIFYING SYNC WORKERS (Tenant: ${TENANT_ID}) 🕵️\n`);

    try {
        // 0. Ensure Schema Correctness (Fix missing index)
        console.log("👉 Step 0: Ensuring Unique Index on identity_ids...");
        await tenantQuery(TENANT_ID, `
            CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_identity_per_patient 
            ON identity_ids (tenant_id, tenant_patient_id, identity_type_code)
        `);
        console.log("   ✅ Index verified/created.");

        // 1. Create Patient
        console.log("👉 Step 1: Creating Tenant Patient...");
        const uniqueCin = "AB" + Date.now();
        const patientId = await patientTenantService.createTenantPatient(TENANT_ID, {
            firstName: "Sync",
            lastName: "Tester",
            dob: "1990-01-01",
            sex: "M",
            status: "VERIFIED",
            identifiers: [
                { typeCode: "CIN", value: uniqueCin, issuingCountryCode: "MA", isPrimary: true }
            ]
        });
        console.log(`   ✅ Created Patient ID: ${patientId}`);

        // Verify Outbox
        const outbox = await tenantQuery(TENANT_ID, `SELECT * FROM identity_sync.outbox_events WHERE entity_id = $1`, [patientId]);
        
        if (outbox.length === 0) {
            console.log("   ❌ Outbox event NOT found for entity_id:", patientId);
            const allOutbox = await tenantQuery(TENANT_ID, `SELECT * FROM identity_sync.outbox_events ORDER BY created_at DESC LIMIT 5`);
            console.log("   Dumping last 5 outbox events:", JSON.stringify(allOutbox, null, 2));
            throw new Error("❌ Outbox event missing!");
        }
        
        if (outbox[0].status !== 'PENDING') {
             console.warn(`⚠️  Outbox event status is '${outbox[0].status}' (Worker running?). Resetting to PENDING...`);
             await tenantQuery(TENANT_ID, `UPDATE identity_sync.outbox_events SET status = 'PENDING' WHERE event_id = $1`, [outbox[0].event_id]);
        } else {
            console.log("   ✅ Outbox event created (Status: PENDING)");
        }

        // 2. Sync Up
        console.log("\n👉 Step 2: Running syncUp()...");
        const sent = await identitySyncService.syncUp(TENANT_ID);
        console.log(`   Sent: ${sent}`);

        // Verify Central Inbox
        // Note: identitySyncService maps tenant event_id to dedupe_key on central
        const inbox = await identityQuery(`SELECT * FROM identity_sync.inbound_events WHERE dedupe_key = $1`, [outbox[0].event_id]);
        if (inbox.length === 0) throw new Error("❌ Central Inbox event missing!");
        console.log("   ✅ Event reached Central Inbox");

        // 3. Process Inbox (Matching)
        console.log("\n👉 Step 3: Running processInbox() (Matching Engine)...");
        const processed = await identitySyncService.processInbox();
        console.log(`   Processed: ${processed}`);

        // Verify MPI Record
        const sourceRecord = await identityQuery(`SELECT * FROM identity.mpi_source_records WHERE source_record_id = $1`, [patientId]);
        if (sourceRecord.length === 0) throw new Error("❌ MPI Source Record not created!");
        console.log("   ✅ MPI Source Record Created.");

        // Verify Membership Link
        const membership = await identityQuery(`SELECT * FROM identity.mpi_person_memberships WHERE source_record_id = $1`, [patientId]);
        if (membership.length === 0) throw new Error("❌ MPI Membership not created!");
        
        const mpiPersonId = membership[0].mpi_person_id;
        console.log(`   ✅ Linked to MPI Person: ${mpiPersonId}`);

        // Verify Central Outbox (MPI_LINK)
        // Check for dedupe_key matching MPI_LINK:tenantPatientId:mpiPersonId
        const dedupeKey = `MPI_LINK:${patientId}:${mpiPersonId}`;
        const centralOutbox = await identityQuery(`
            SELECT * FROM identity_sync.outbound_events 
            WHERE dedupe_key = $1
        `, [dedupeKey]);
        if (centralOutbox.length === 0) throw new Error("❌ MPI_LINK event missing in Central Outbox!");
        console.log("   ✅ MPI_LINK event created in Central Outbox");

        // 4. Sync Down
        console.log("\n👉 Step 4: Running syncDown()...");
        const applied = await identitySyncService.syncDown(TENANT_ID);
        console.log(`   Applied: ${applied}`);

        // Verify Tenant Identity ID
        const ids = await tenantQuery(TENANT_ID, `
            SELECT * FROM identity_ids 
            WHERE tenant_patient_id = $1 AND identity_type_code = 'SAHTY_MPI_PERSON_ID'
        `, [patientId]);
        
        if (ids.length === 0) throw new Error("❌ Tenant did not receive SAHTY_MPI_PERSON_ID!");
        if (ids[0].identity_value !== mpiPersonId) throw new Error("❌ Mismatch in MPI Person ID!");
        
        console.log(`   ✅ Tenant successfully updated with SAHTY_MPI_PERSON_ID: ${ids[0].identity_value}`);

        console.log("\n✨ SYNC VERIFICATION SUCCESSFUL ✨");

    } catch (e: any) {
        console.error("\n❌ VERIFICATION FAILED:", e);
    } finally {
        await closeGlobalPool();
        process.exit(0);
    }
}

runVerification();
