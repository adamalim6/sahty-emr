import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migration 123 (ECG/Echo creator name columns) ---');
    
    const clients = await globalQuery('SELECT id FROM tenants');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/123_ecg_echo_creator_names.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 123_ecg_echo_creator_names.sql...`);
            await client.query(sql);
            console.log(`✅ Tenant ${tenantId} Migration 123 Successful.`);
        } catch (e) {
            console.error(`❌ Tenant ${tenantId} Migration 123 Failed:`, e);
            throw e;
        } finally {
            client.release();
        }
    }
    process.exit(0);
}

runTenantMigrations().catch(console.error);
