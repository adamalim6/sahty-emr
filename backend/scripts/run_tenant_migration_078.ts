import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigration078() {
    console.log('--- Running Tenant Migration 078 (Smart Phrases) ---');
    
    const clients = await globalQuery('SELECT id FROM tenants');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/078_create_smart_phrases.sql');
            let sql = fs.readFileSync(sqlPath, 'utf8');
            sql = sql.replace(/__TENANT_ID__/g, tenantId);
            
            console.log(`  Executing 078_create_smart_phrases.sql...`);
            await client.query(sql);

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful.`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant ${tenantId} Migration Failed:`, e);
        } finally {
            client.release();
        }
    }
    process.exit(0);
}

runTenantMigration078().catch(console.error);
