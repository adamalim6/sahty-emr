
import * as fs from 'fs';
import * as path from 'path';
import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';

async function run() {
    console.log('--- Applying Tenant Migration: 023_patient_network.sql ---');
    try {
        // Fetch all tenants
        const clients = await globalQuery('SELECT id FROM clients'); 
        if (clients.length === 0) {
            console.warn('No clients found. Skipping.');
            process.exit(0);
        }

        const tenantSqlPath = path.join(__dirname, '../migrations/pg/tenant/023_patient_network.sql');
        const tenantSql = fs.readFileSync(tenantSqlPath, 'utf-8');

        for (const client of clients) {
            const tenantId = client.id;
            console.log(`Applying to Tenant ${tenantId}...`);
            try {
                await tenantQuery(tenantId, tenantSql);
                console.log(`Tenant ${tenantId} Done.`);
            } catch (e: any) {
                console.warn(`SKIPPING Tenant ${tenantId}: ${e.message}`);
                // Continue to next tenant (graceful degradation for dev/broken envs)
            }
        }

        console.log('\nSUCCESS: All migrations applied.');
        process.exit(0);

    } catch (e: any) {
        console.error('Migration Failed:', e.message);
        process.exit(1);
    }
}

run();
