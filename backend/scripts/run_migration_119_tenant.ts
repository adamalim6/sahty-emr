import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migration 119 (current_stock unique constraint) ---');
    const clients = await globalQuery('SELECT id FROM tenants');
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const sqlPath = path.join(__dirname, '../migrations/pg/tenant/119_current_stock_unique_constraint.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await client.query(sql);
            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful.`);
        } catch (e: any) {
            await client.query('ROLLBACK');
            if (e.message?.includes('already exists')) {
                console.log(`✓ Tenant ${tenantId} constraint already exists, skipping.`);
            } else {
                console.error(`❌ Tenant ${tenantId} Migration Failed:`, e);
                throw e;
            }
        } finally {
            client.release();
        }
    }
    process.exit(0);
}
runTenantMigrations().catch(console.error);
