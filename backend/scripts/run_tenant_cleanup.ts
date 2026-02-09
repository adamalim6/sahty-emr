
import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runCleanupMigration() {
    console.log('--- Running Tenant Cleanup Migration (003) ---');
    
    // Get all tenants
    const clients = await globalQuery('SELECT id FROM clients');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/003_drop_global_patient_id.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 003_drop_global_patient_id.sql...`);
            await client.query(sql);

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Cleanup Successful.`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant ${tenantId} Cleanup Failed:`, e);
            // Non-fatal, continue
        } finally {
            client.release();
        }
    }
}

runCleanupMigration().catch(console.error);
