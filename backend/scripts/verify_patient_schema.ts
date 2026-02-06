
import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function verify() {
    console.log('--- Verifying Schema ---');

    // 1. GLOBAL
    try {
        console.log('Checking Global DB...');
        const globalTables = await globalQuery(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('patients_global', 'identity_document_types', 'global_identity_documents', 'countries', 'patients')
        `);
        const names = globalTables.map((r: any) => r.table_name);
        
        if (names.includes('patients')) {
            console.warn('WARNING: legacy "patients" table still exists (should be dropped).');
        }
        if (!names.includes('patients_global')) throw new Error('Missing patients_global');
        if (!names.includes('identity_document_types')) throw new Error('Missing identity_document_types');
        
        // Check Master Data
        const docTypes = await globalQuery('SELECT code FROM identity_document_types');
        console.log('Doc Types:', docTypes.map((r: any) => r.code));
        if (!docTypes.find((r: any) => r.code === 'CIN')) throw new Error('Missing CIN doc type');

        console.log('Global DB Verified OK.');
    } catch (e: any) {
        console.error('Global Verification Failed:', e.message);
        process.exit(1);
    }

    // 2. TENANT
    try {
        // Pick one tenant (first available)
        const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
        if (clients.length === 0) {
            console.log('No tenants to verify.');
            return;
        }
        const tenantId = clients[0].id;
        console.log(`Checking Tenant DB (${tenantId})...`);

        const tenantTables = await tenantQuery(tenantId, `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('patients_tenant', 'patient_contacts', 'patient_insurances')
        `);
        const tNames = tenantTables.map((r: any) => r.table_name);
        
        if (!tNames.includes('patients_tenant')) throw new Error('Missing patients_tenant');
        
        // Check Admissions Column
        const admCols = await tenantQuery(tenantId, `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'admissions' AND column_name = 'tenant_patient_id'
        `);
        if (admCols.length === 0) throw new Error('Admissions missing tenant_patient_id');

        console.log('Tenant DB Verified OK.');

    } catch (e: any) {
        console.error('Tenant Verification Failed:', e.message);
        process.exit(1);
    }
    
    console.log('\n--- VERIFICATION SUCCESS ---');
    process.exit(0);
}

verify();
