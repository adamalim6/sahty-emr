import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migration 127 (Coverage SELF uniqueness) ---');

    const clients = await globalQuery('SELECT id FROM tenants');

    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);

        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/127_coverage_self_unique.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 127_coverage_self_unique.sql...`);
            await client.query(sql);
            console.log(`✅ Tenant ${tenantId} Migration 127 Successful.`);
        } catch (e) {
            console.error(`❌ Tenant ${tenantId} Migration 127 Failed:`, e);
            throw e;
        } finally {
            client.release();
        }
    }
    process.exit(0);
}

runTenantMigrations().catch(console.error);
