
import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigration004() {
    console.log('--- Running Tenant Migration 004 (Fix Document Types) ---');
    
    // Get all tenants
    const clients = await globalQuery('SELECT id FROM clients');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/004_fix_tenant_document_types.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`  Executing 004_fix_tenant_document_types.sql...`);
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
}

runTenantMigration004().catch(console.error);
