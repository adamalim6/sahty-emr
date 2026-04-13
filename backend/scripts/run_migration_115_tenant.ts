import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migration 115 (lab_requests nullable event) ---');
    
    const clients = await globalQuery('SELECT id FROM tenants');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/115_lab_requests_nullable_event.sql');
            let sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 115_lab_requests_nullable_event.sql...`);
            await client.query(sql);

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful.`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant ${tenantId} Migration Failed:`, e);
            throw e;
        } finally {
            client.release();
        }
    }
    process.exit(0);
}

runTenantMigrations().catch(console.error);
