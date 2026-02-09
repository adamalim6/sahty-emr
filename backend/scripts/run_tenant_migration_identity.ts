
import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Identity Migrations ---');
    
    // Get all tenants
    const clients = await globalQuery('SELECT id FROM clients');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const files = [
                '001_identity_schema_tenant.sql',
                '002_refactor_patient_tenant.sql'
            ];

            for (const file of files) {
                const sqlPath = path.join(__dirname, '../migrations/pg/tenant', file);
                const sql = fs.readFileSync(sqlPath, 'utf8');
                console.log(`  Executing ${file}...`);
                await client.query(sql);
            }

            await client.query('COMMIT');
            console.log(`✅ Tenant ${tenantId} Migration Successful.`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant ${tenantId} Migration Failed:`, e);
            // Optionally continue to next tenant or stop? stopping is safer for now.
             process.exit(1);
        } finally {
            client.release();
        }
    }
}

runTenantMigrations().catch(console.error);
