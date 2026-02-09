
import { getTenantPool } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';

async function inspectSchema() {
    console.log('--- Inspecting Tenant Schema ---');
    
    // Get a valid tenant
    const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
    if (clients.length === 0) {
        console.error('No tenants found.');
        return;
    }
    const tenantId = clients[0].id;
    console.log(`Using Tenant: ${tenantId}`);

    const pool = getTenantPool(tenantId);
    
    // Switch to global pool inspection
    const globalPool = getTenantPool('sahty_global'); // Actually need to use globalQuery helper or pool if accessible differently?
    // inspect_identity_schema uses getTenantPool. globalQuery exports a pool? no, it exports helper.
    // Let's use globalQuery to inspect information_schema of global db.
    
    console.log(`\nTable: sahty_global.public.patients_global`);
    const globalCols = await globalQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'patients_global'
        ORDER BY ordinal_position
    `);

    if (globalCols.length === 0) {
        console.log('  (Table not found)');
    } else {
        globalCols.forEach((col: any) => {
            console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable})`);
        });
    }

    process.exit(0);
}

inspectSchema().catch(console.error);
