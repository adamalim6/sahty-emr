import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runDropColumnMigrations() {
    console.log('--- Running Migration 104: Drop details/data JSONB from prescriptions ---');
    
    // Get all active tenants
    const clients = await globalQuery('SELECT id FROM tenants');
    
    let successCount = 0;
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant DB: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/104_drop_details_from_prescriptions.sql');
            let sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 104_drop_details_from_prescriptions.sql...`);
            await client.query(sql);

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful. Column dropped.`);
            successCount++;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant ${tenantId} Migration Failed:`, e);
        } finally {
            client.release();
        }
    }
    console.log(`\n🎉 Successfully migrated ${successCount}/${clients.length} active tenants.`);
    process.exit(0);
}

runDropColumnMigrations().catch(console.error);
