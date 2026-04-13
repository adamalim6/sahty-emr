import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migration 121 (ECG/Echo tables + note_type extension) ---');
    
    const clients = await globalQuery('SELECT id FROM tenants');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/121_ecg_echo_records.sql');
            let sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 121_ecg_echo_records.sql...`);
            await client.query(sql);

            console.log(`✅ Tenant ${tenantId} Migration 121 Successful.`);
        } catch (e) {
            console.error(`❌ Tenant ${tenantId} Migration 121 Failed:`, e);
            throw e;
        } finally {
            client.release();
        }
    }
    process.exit(0);
}

runTenantMigrations().catch(console.error);
