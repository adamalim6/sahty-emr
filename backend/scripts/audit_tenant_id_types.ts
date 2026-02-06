
import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function audit() {
    console.log('--- Auditing Tenant ID Types ---');

    // Get first active tenant to audit
    const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
    if (!clients.length) {
        console.log('No tenants found.');
        return;
    }
    const tenantId = clients[0].id;
    console.log(`Auditing Tenant: ${tenantId}`);

    // Query information_schema
    const columns = await tenantQuery(tenantId, `
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND (column_name LIKE '%tenant_id%' OR column_name LIKE '%client_id%')
        ORDER BY table_name;
    `);

    console.log('\nFound Columns:');
    let issuesFound = 0;
    
    for (const col of columns) {
        const isUuid = col.data_type === 'uuid';
        const status = isUuid ? '✅ UUID' : '❌ ' + col.data_type.toUpperCase();
        
        if (!isUuid) issuesFound++;
        
        console.log(`- ${col.table_name}.${col.column_name}: ${status}`);
    }

    if (issuesFound > 0) {
        console.log(`\nfound ${issuesFound} columns to fix.`);
    } else {
        console.log('\nAll tenant_id/client_id columns are UUID.');
    }
    
    process.exit(0);
}

audit();
