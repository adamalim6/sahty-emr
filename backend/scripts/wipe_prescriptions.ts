import { tenantQuery } from '../db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        console.log(`Wiping prescriptions data for tenant ${TENANT_ID}...`);
        
        // administration_events has foreign key to prescription_events
        console.log('Deleting from administration_events...');
        await tenantQuery(TENANT_ID, 'DELETE FROM administration_events;');
        
        // prescription_events has foreign key to patient_prescriptions
        console.log('Deleting from prescription_events...');
        await tenantQuery(TENANT_ID, 'DELETE FROM prescription_events;');
        
        // patient_prescriptions is the parent table
        console.log('Deleting from patient_prescriptions...');
        await tenantQuery(TENANT_ID, 'DELETE FROM patient_prescriptions;');
        
        console.log('Successfully wiped all prescription and administration data!');
        process.exit(0);
    } catch (e: any) {
        console.error('Failed to wipe data:', e.message);
        console.error(e);
        process.exit(1);
    }
}

run();
