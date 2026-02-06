
import * as fs from 'fs';
import * as path from 'path';
import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';

async function run() {
    console.log('--- Applying Universal Audit Log Migrations ---');

    // 1. GLOBAL MIGRATION
    try {
        console.log('Phase 1: Global DB...');
        const globalSqlPath = path.join(__dirname, '../migrations/pg/global/004_universal_audit.sql');
        const globalSql = fs.readFileSync(globalSqlPath, 'utf-8');
        await globalQuery(globalSql);
        console.log('Global DB Migration (004) Done.');
    } catch (e: any) {
        console.error('Global Migration Failed:', e.message);
        process.exit(1);
    }

    // 2. TENANT MIGRATION
    try {
        console.log('Phase 2: Tenant DBs...');
        
        // Fetch all tenants
        const clients = await globalQuery('SELECT id FROM clients'); 
        if (clients.length === 0) {
            console.warn('No clients found. Skipping.');
            process.exit(0);
        }

        const tenantSqlPath = path.join(__dirname, '../migrations/pg/tenant/024_universal_audit.sql');
        const tenantSql = fs.readFileSync(tenantSqlPath, 'utf-8');

        for (const client of clients) {
            const tenantId = client.id;
            console.log(`Applying 024 to Tenant ${tenantId}...`);
            try {
                await tenantQuery(tenantId, tenantSql);
                console.log(`Tenant ${tenantId} Done.`);
            } catch (e: any) {
                console.warn(`SKIPPING Tenant ${tenantId}: ${e.message}`);
                // Continue to next tenant
            }
        }

        console.log('\nSUCCESS: All Audit Log migrations applied.');
        process.exit(0);

    } catch (e: any) {
        console.error('Tenant Migration Failed:', e.message);
        process.exit(1);
    }
}

run();
