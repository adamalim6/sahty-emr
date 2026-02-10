/**
 * Verify Admissions + Placement Refactor
 * Tests the full lifecycle: room types → rooms → beds → admissions → stays → transfers
 */

import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';
import { settingsService } from '../services/settingsService';
import { placementService } from '../services/placementService';
import { emrService } from '../services/emrService';

const PASS = '✅';
const FAIL = '❌';
let passed = 0, failed = 0;

function check(name: string, ok: boolean, detail?: string) {
    if (ok) { passed++; console.log(`  ${PASS} ${name}`); }
    else { failed++; console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function main() {
    const tenants = await globalQuery('SELECT id, designation FROM tenants LIMIT 1');
    const tenantId = tenants[0].id;
    const tenantName = tenants[0].designation;
    console.log(`\n=== Verifying on ${tenantName} (${tenantId}) ===\n`);

    // 1. Schema check
    console.log('--- 1. Schema Verification ---');
    const tables = await tenantQuery(tenantId, `
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('room_types','beds','patient_stays','rooms','admissions')
        ORDER BY table_name
    `);
    const tableNames = tables.map((t: any) => t.table_name);
    check('room_types table exists', tableNames.includes('room_types'));
    check('beds table exists', tableNames.includes('beds'));
    check('patient_stays table exists', tableNames.includes('patient_stays'));
    check('rooms table exists', tableNames.includes('rooms'));
    check('admissions table exists', tableNames.includes('admissions'));

    // Verify admissions columns
    const admCols = await tenantQuery(tenantId, `
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'admissions' AND table_schema = 'public'
    `);
    const admColNames = admCols.map((c: any) => c.column_name);
    check('admission_number column', admColNames.includes('admission_number'));
    check('attending_physician_user_id column', admColNames.includes('attending_physician_user_id'));
    check('admitting_service_id column', admColNames.includes('admitting_service_id'));
    check('responsible_service_id column', admColNames.includes('responsible_service_id'));
    check('current_service_id column', admColNames.includes('current_service_id'));
    check('patient_id removed', !admColNames.includes('patient_id'));
    check('nda removed', !admColNames.includes('nda'));
    check('doctor_name removed', !admColNames.includes('doctor_name'));
    check('room_number removed', !admColNames.includes('room_number'));
    check('bed_label removed', !admColNames.includes('bed_label'));

    // 2. Room Types CRUD
    console.log('\n--- 2. Room Types CRUD ---');
    const rt = await settingsService.createUnitType(tenantId, {
        id: '', name: 'Chambre VIP', description: 'Suite privée',
        unit_category: 'CHAMBRE', number_of_beds: 1
    });
    check('createUnitType returns id', !!rt.id);
    check('createUnitType name correct', rt.name === 'Chambre VIP');

    const allTypes = await settingsService.getUnitTypes(tenantId);
    check('getUnitTypes includes new type', allTypes.some((t: any) => t.id === rt.id));

    const updated = await settingsService.updateUnitType(tenantId, {
        ...rt, name: 'Suite VIP', number_of_beds: 2
    });
    check('updateUnitType name changed', updated.name === 'Suite VIP');

    await settingsService.deleteUnitType(tenantId, rt.id);
    const afterDelete = await settingsService.getUnitTypes(tenantId);
    check('deleteUnitType soft-deletes (not in active list)', !afterDelete.some((t: any) => t.id === rt.id));

    // Verify still in DB
    const inDb = await tenantQuery(tenantId, 'SELECT id, is_active FROM room_types WHERE id = $1', [rt.id]);
    check('soft-deleted room type still in DB', inDb.length === 1 && !inDb[0].is_active);

    // 3. Room + Bed lifecycle
    console.log('\n--- 3. Rooms & Beds ---');
    // Get a service
    const services = await tenantQuery(tenantId, 'SELECT id FROM services LIMIT 1');
    if (services.length === 0) {
        console.log('  ⚠️  No services found — skipping room/bed/stay tests');
        printSummary();
        return;
    }
    const serviceId = services[0].id;

    // Create a room type for testing
    const testRT = await settingsService.createUnitType(tenantId, {
        id: '', name: 'Test Room Type', unit_category: 'CHAMBRE', number_of_beds: 2
    });

    const room = await placementService.createRoom(tenantId, {
        serviceId, roomTypeId: testRT.id, name: 'Room 101', description: 'Test room'
    });
    check('createRoom returns room', !!room.id && room.name === 'Room 101');

    const bed1 = await placementService.createBed(tenantId, { roomId: room.id, label: 'Bed A' });
    const bed2 = await placementService.createBed(tenantId, { roomId: room.id, label: 'Bed B' });
    check('createBed returns bed', !!bed1.id && bed1.status === 'AVAILABLE');

    const beds = await placementService.getBedsByRoom(tenantId, room.id);
    check('getBedsByRoom returns 2 beds', beds.length === 2);

    // 4. Admission with new model
    console.log('\n--- 4. Admission Lifecycle ---');
    // Get or create a tenant patient
    const patients = await tenantQuery(tenantId, 'SELECT tenant_patient_id FROM patients_tenant LIMIT 1');
    if (patients.length === 0) {
        console.log('  ⚠️  No patients found — skipping admission/stay tests');
        await cleanup(tenantId, testRT.id, room.id);
        printSummary();
        return;
    }
    const tenantPatientId = patients[0].tenant_patient_id;

    const admission = await emrService.createAdmission(tenantId, {
        tenantPatientId,
        reason: 'Test admission',
        admittingServiceId: serviceId,
        responsibleServiceId: serviceId,
        currentServiceId: serviceId,
        admissionDate: new Date().toISOString(),
        status: 'En cours',
    });
    check('admission has admission_number', !!admission.admissionNumber);
    check('admission_number format starts with ADM-', admission.admissionNumber!.startsWith('ADM-'));
    check('admission has 3 service IDs', !!admission.admittingServiceId && !!admission.responsibleServiceId && !!admission.currentServiceId);

    // 5. Stays
    console.log('\n--- 5. Patient Stays ---');
    const stay1 = await placementService.assignInitialBed(tenantId, admission.id, tenantPatientId, bed1.id);
    check('assignInitialBed creates stay', !!stay1.id && !stay1.endedAt);

    // Verify bed is now OCCUPIED
    const bedAfterAssign = await placementService.getBedsByRoom(tenantId, room.id);
    const b1 = bedAfterAssign.find(b => b.id === bed1.id);
    check('bed1 is OCCUPIED after assignment', b1!.status === 'OCCUPIED');

    // Transfer
    const stay2 = await placementService.transferBed(tenantId, admission.id, bed2.id);
    check('transferBed creates new stay', !!stay2.id && stay2.bedId === bed2.id);

    // Verify old bed freed, new bed occupied
    const bedsAfterTransfer = await placementService.getBedsByRoom(tenantId, room.id);
    const b1After = bedsAfterTransfer.find(b => b.id === bed1.id);
    const b2After = bedsAfterTransfer.find(b => b.id === bed2.id);
    check('bed1 AVAILABLE after transfer', b1After!.status === 'AVAILABLE');
    check('bed2 OCCUPIED after transfer', b2After!.status === 'OCCUPIED');

    // Stay history
    const stays = await placementService.getStaysByAdmission(tenantId, admission.id);
    check('2 stays in history', stays.length === 2);
    check('first stay ended', !!stays[0].endedAt);
    check('second stay active', !stays[1].endedAt);

    // 6. Close admission
    console.log('\n--- 6. Close Admission ---');
    const closed = await emrService.closeAdmission(tenantId, admission.id);
    check('closeAdmission returns Sorti', closed!.status === 'Sorti');

    const bedsAfterClose = await placementService.getBedsByRoom(tenantId, room.id);
    const b2AfterClose = bedsAfterClose.find(b => b.id === bed2.id);
    check('bed2 AVAILABLE after discharge', b2AfterClose!.status === 'AVAILABLE');

    const staysAfterClose = await placementService.getStaysByAdmission(tenantId, admission.id);
    check('all stays ended after discharge', staysAfterClose.every(s => !!s.endedAt));

    // 7. Guard tests
    console.log('\n--- 7. Guards ---');
    try {
        await placementService.updateBedStatus(tenantId, bed1.id, 'MAINTENANCE');
        check('can set empty bed to MAINTENANCE', true);
        await placementService.updateBedStatus(tenantId, bed1.id, 'AVAILABLE');
    } catch (e: any) {
        check('guard: maintenance on empty bed', false, e.message);
    }

    // Cleanup
    await cleanup(tenantId, testRT.id, room.id);
    printSummary();
}

async function cleanup(tenantId: string, roomTypeId: string, roomId: string) {
    // Clean up test data (reverse order)
    try {
        await tenantQuery(tenantId, `DELETE FROM patient_stays WHERE admission_id IN (SELECT id FROM admissions WHERE reason = 'Test admission')`);
        await tenantQuery(tenantId, `DELETE FROM admissions WHERE reason = 'Test admission'`);
        await tenantQuery(tenantId, `DELETE FROM beds WHERE room_id = $1`, [roomId]);
        await tenantQuery(tenantId, `DELETE FROM rooms WHERE id = $1`, [roomId]);
        await tenantQuery(tenantId, `DELETE FROM room_types WHERE id = $1`, [roomTypeId]);
    } catch (e: any) {
        console.log('  ⚠️  Cleanup error:', e.message);
    }
}

function printSummary() {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('='.repeat(40));
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
