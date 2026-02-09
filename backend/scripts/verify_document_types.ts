
import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import { patientGlobalService } from '../services/patientGlobalService';

async function verifyDocumentTypes() {
    console.log('--- Verifying Document Types Reversion ---');

    // 1. Check Global Public
    console.log('\n[Global] Checking public.identity_document_types...');
    const globalPub = await globalQuery(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'identity_document_types'
        );
    `);
    if (globalPub[0].exists) {
        console.log('✅ public.identity_document_types exists.');
        const count = await globalQuery('SELECT COUNT(*) FROM public.identity_document_types');
        console.log(`   Count: ${count[0].count}`);
    } else {
        console.error('❌ public.identity_document_types MISSING!');
    }

    // 2. Check Global Identity (should be gone)
    console.log('\n[Global] Checking identity.document_types (should be gone)...');
    const globalIdent = await globalQuery(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'identity' 
            AND table_name = 'document_types'
        );
    `);
    if (!globalIdent[0].exists) {
        console.log('✅ identity.document_types is gone.');
    } else {
        console.error('❌ identity.document_types STILL EXISTS!');
    }

    // 3. Check Tenant Reference (on first tenant)
    const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
    if (clients.length > 0) {
        const tenantId = clients[0].id;
        console.log(`\n[Tenant ${tenantId}] Checking reference.identity_document_types...`);
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();
        try {
            const tenantRef = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'reference' 
                    AND table_name = 'identity_document_types'
                );
            `);
            if (tenantRef.rows[0].exists) {
                console.log('✅ reference.identity_document_types exists.');
                const count = await client.query('SELECT COUNT(*) FROM reference.identity_document_types');
                console.log(`   Count: ${count.rows[0].count}`);
            } else {
                console.error('❌ reference.identity_document_types MISSING!');
            }

            // 4. Check Tenant Identity (should be gone)
            console.log(`\n[Tenant ${tenantId}] Checking identity.document_types (should be gone)...`);
            const tenantIdent = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'identity' 
                    AND table_name = 'document_types'
                );
            `);
            if (!tenantIdent.rows[0].exists) {
                console.log('✅ identity.document_types is gone.');
            } else {
                console.error('❌ identity.document_types STILL EXISTS!');
            }
        } finally {
            client.release();
        }
    }

    // 5. Check Service Method
    console.log('\n[Service] Testing patientGlobalService.getDocumentTypes()...');
    try {
        const types = await patientGlobalService.getDocumentTypes();
        console.log(`✅ Service returned ${types.length} types.`);
        if (types.length > 0) {
            console.log(`   Sample: ${types[0].id} - ${types[0].label}`);
        }
    } catch (e) {
        console.error('❌ Service Call Failed:', e);
    }
}

verifyDocumentTypes().catch(console.error);
