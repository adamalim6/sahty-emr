
import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    console.log('--- Applying UUID Standardization Migration (025) ---');

    // 1. Get all tenants
    const clients = await globalQuery('SELECT id FROM clients');
    console.log(`Found ${clients.length} tenants.`);

    // 2. Read Migration File
    const migrationPath = path.join(__dirname, '../migrations/pg/tenant/025_standardize_tenant_ids.sql');
    if (!fs.existsSync(migrationPath)) {
        console.error('Migration file not found:', migrationPath);
        process.exit(1);
    }
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // 3. Apply to each tenant
    for (const client of clients) {
        const tenantId = client.id;
        console.log(`Applying to Tenant ${tenantId}...`);
        try {
            await tenantQuery(tenantId, migrationSql);
            console.log(`Tenant ${tenantId} Done.`);
        } catch (error) {
            console.error(`Error applying to tenant ${tenantId}:`, error);
        }
    }

    console.log('--- Done ---');
    process.exit(0);
}

run();
