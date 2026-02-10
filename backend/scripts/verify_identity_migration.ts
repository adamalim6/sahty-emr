
import { identityService } from '../services/identityService';
import { patientGlobalService } from '../services/patientGlobalService';
import { getIdentityPool } from '../db/identityPg';

async function main() {
    console.log('--- Verifying Identity Migration ---');

    // 1. Check Identity DB Connection
    try {
        const res = await getIdentityPool().query('SELECT current_database()');
        console.log(`Connected to DB: ${res.rows[0].current_database}`);
        if (res.rows[0].current_database !== 'sahty_identity') {
            throw new Error('Using wrong database!');
        }
    } catch (e: any) {
        console.error('Failed to connect to sahty_identity:', e);
        process.exit(1);
    }

    // 2. Test Identity Service (Read)
    console.log('\nTesting IdentityService.searchPatients...');
    // Should query identity.master_patients in sahty_identity
    const results = await identityService.searchPatients('GLOBAL', 'TEST');
    console.log(`Search results: ${results.length}`);

    // 3. Test PatientGlobalService (Read Reference from Global, Identity from Identity)
    console.log('\nTesting PatientGlobalService.getDocumentTypes (Reference)...');
    try {
        const types = await patientGlobalService.getDocumentTypes();
        console.log(`Document Types found: ${types.length}`);
        if (types.length === 0) console.warn('Warning: No document types found in global reference.');
        else console.log('Sample:', types[0]);
    } catch (e: any) {
        console.error('Failed to read reference data:', e);
    }

    // 4. Test Create Identity (Transaction across Reference read + Identity write)
    console.log('\nTesting PatientGlobalService.createIdentity...');
    try {
        const newPatient = await patientGlobalService.createIdentity({
            firstName: 'Jean',
            lastName: 'Dupont',
            gender: 'M',
            dateOfBirth: '1980-01-01',
            documents: [
                { documentTypeCode: 'CIN', documentNumber: 'AB123456', isPrimary: true }
            ]
        });
        console.log('Created Patient:', newPatient.id);
        
        // Verify in DB
        const verify = await identityService.getPatientById('GLOBAL', newPatient.id);
        console.log('Verified in DB:', verify?.id === newPatient.id);

    } catch (e: any) {
        if (e.message.includes('Invalid Document Type')) {
            console.log('Caught Expected Error (if CIN missing):', e.message);
        } else {
            console.error('Failed to create identity:', e);
        }
    }

    console.log('\n--- Verification Complete ---');
    process.exit(0);
}

main();
