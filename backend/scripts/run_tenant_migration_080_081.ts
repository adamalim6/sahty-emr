import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function runTenantMigrations() {
    console.log('--- Running Tenant Migrations 080 & 081 (Examen Clinique Persistence) ---');
    
    const clients = await globalQuery('SELECT id FROM tenants');
    
    for (const clientRow of clients) {
        const tenantId = clientRow.id;
        console.log(`\nMigrating Tenant: ${tenantId}...`);
        
        const pool = getTenantPool(tenantId);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const sqlPath80 = path.join(__dirname, '../migrations/pg/tenant/080_extend_surveillance_events.sql');
            let sql80 = fs.readFileSync(sqlPath80, 'utf8');
            console.log(`  Executing 080_extend_surveillance_events.sql...`);
            await client.query(sql80);

            const sqlPath81 = path.join(__dirname, '../migrations/pg/tenant/081_create_clinical_exams.sql');
            let sql81 = fs.readFileSync(sqlPath81, 'utf8');
            console.log(`  Executing 081_create_clinical_exams.sql...`);
            await client.query(sql81);

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

runTenantMigrations().catch(console.error);
