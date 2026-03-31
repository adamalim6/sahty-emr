import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runDropColumnMigrations() {
    console.log('--- Running Migration 105: Structure Prescription Events Status ---');
    
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

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/105_refactor_prescription_events_status.sql');
            let sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 105_refactor_prescription_events_status.sql...`);
            await client.query(sql);

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful. Status locked strictly securely.`);
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
