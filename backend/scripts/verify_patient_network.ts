
import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';
import { patientNetworkService } from '../services/patientNetworkService';

async function verify() {
    console.log('--- Verifying Patient Network ---');

    try {
        // 1. Get Tenant
        const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
        if (clients.length === 0) {
             console.log('No tenants found. Skipping.');
             return;
        }
        const tenantId = clients[0].id;
        console.log(`Using Tenant: ${tenantId}`);

        // 2. Check Tables
        const tables = await tenantQuery(tenantId, `
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('persons', 'patient_relationships', 'patient_emergency_contacts')
        `);
        const names = tables.map((t: any) => t.table_name);
        if (!names.includes('persons')) throw new Error('Missing table: persons');
        if (!names.includes('patient_relationships')) throw new Error('Missing table: patient_relationships');

        // 3. Functional Test
        // Need a patient
        // Need a patient
        let patientId = '';
        const patients = await tenantQuery(tenantId, 'SELECT tenant_patient_id FROM patients_tenant LIMIT 1');
        if (patients.length > 0) {
            patientId = patients[0].tenant_patient_id;
        } else {
            console.log('No patients found. Creating test patient...');
            // Create Global
            const { patientGlobalService } = require('../services/patientGlobalService');
            // Mock global service or direct insert?
            // Let's use service if possible, need to mock context or just call it directly since we are in script.
            // But verify_patient_schema.ts imported services? No, it used query directly.
            // Let's use direct query to be safe and avoid service dep complexity in script if imports tricky.
            // Actually I can import the service.
            
            const gRes = await globalQuery(`
                INSERT INTO patients_global (first_name, last_name, date_of_birth, gender)
                VALUES ('Test', 'Patient', '2000-01-01', 'M')
                RETURNING global_patient_id
            `);
            const globalId = gRes[0].global_patient_id;
            
            const tRes = await tenantQuery(tenantId, `
                INSERT INTO patients_tenant (tenant_id, global_patient_id, medical_record_number, status)
                VALUES ($1, $2, 'TEST-MRN', 'ACTIVE')
                RETURNING tenant_patient_id
            `, [tenantId, globalId]);
            patientId = tRes[0].tenant_patient_id;
            console.log(`Created Test Patient: ${patientId}`);
        }

        // Create Person
        console.log('Creating Person...');
        const personId = await patientNetworkService.createPerson(tenantId, {
            firstName: 'Jean',
            lastName: 'Dupont (Father)',
            phone: '0600000000'
        });
        console.log(`Created Person: ${personId}`);

        // Add Relationship (Father)
        console.log('Adding Relationship...');
        await patientNetworkService.addRelationship(tenantId, {
            subjectPatientId: patientId,
            relatedPersonId: personId,
            relationshipType: 'FATHER',
            validFrom: new Date().toISOString()
        });

        // Add Emergency Contact
        console.log('Adding Emergency Contact...');
        await patientNetworkService.addEmergencyContact(tenantId, {
            tenantPatientId: patientId,
            relatedPersonId: personId,
            relationshipLabel: 'Papa',
            priority: 1
        });

        // Fetch Network
        console.log('Fetching Network...');
        const network = await patientNetworkService.getNetwork(tenantId, patientId);
        console.log('Network:', JSON.stringify(network, null, 2));

        if (network.relationships.length === 0) throw new Error('Relationship not returned');
        if (network.emergencyContacts.length === 0) throw new Error('Emergency Contact not returned');

        console.log('\n--- VERIFICATION SUCCESS ---');
        process.exit(0);

    } catch (e: any) {
        console.error('Verification Failed:', e.message);
        process.exit(1);
    }
}

verify();
