
import { TenantProvisioningService } from '../services/tenantProvisioningService';
import { Pool } from 'pg';
import { getTenantDbName } from '../db/tenantPg';

const TEST_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const TEST_DB_NAME = getTenantDbName(TEST_TENANT_ID);
const REF_TENANT_ID = '3861b58c-69a7-4113-b503-378a08c700b7';

async function simulateProvisioning() {
    console.log('--- Simulating Provisioning for New Tenant ---');
    console.log(`Test Tenant ID: ${TEST_TENANT_ID}`);
    console.log(`Test DB Name:   ${TEST_DB_NAME}`);
    console.log(`Reference:      tenant_${REF_TENANT_ID}\n`);

    // Admin pool to drop/create databases
    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: process.env.PG_DB || 'sahty_emr'
    });

    try {
        // 1. Clean up any previous test DB
        console.log('Step 1: Dropping old test DB if exists...');
        try {
            // Force disconnect all clients
            await adminPool.query(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [TEST_DB_NAME]);
            await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
            console.log(`  Dropped ${TEST_DB_NAME}\n`);
        } catch (e: any) {
            console.log(`  Nothing to drop: ${e.message}\n`);
        }

        // 2. Run provisioning
        console.log('Step 2: Running tenantProvisioningService.createTenantDatabase()...');
        const service = TenantProvisioningService.getInstance();
        await service.createTenantDatabase(TEST_TENANT_ID);
        console.log('\n✅ Provisioning completed successfully!\n');

        // 3. Compare schema with reference tenant
        console.log('Step 3: Comparing schema with reference tenant...');
        
        const testPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: TEST_DB_NAME
        });

        const refPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: `tenant_${REF_TENANT_ID}`
        });

        // Compare schemas
        const schemaQuery = `
            SELECT schema_name FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name
        `;
        const testSchemas = (await testPool.query(schemaQuery)).rows.map(r => r.schema_name);
        const refSchemas = (await refPool.query(schemaQuery)).rows.map(r => r.schema_name);

        console.log('\n=== SCHEMAS ===');
        console.log(`  Reference: ${refSchemas.join(', ')}`);
        console.log(`  Test:      ${testSchemas.join(', ')}`);
        const missingSchemas = refSchemas.filter(s => !testSchemas.includes(s));
        const extraSchemas = testSchemas.filter(s => !refSchemas.includes(s));
        if (missingSchemas.length) console.log(`  ❌ Missing: ${missingSchemas.join(', ')}`);
        if (extraSchemas.length) console.log(`  ⚠️ Extra:   ${extraSchemas.join(', ')}`);
        if (!missingSchemas.length && !extraSchemas.length) console.log('  ✅ Match!');

        // Compare tables per schema
        const tableQuery = `
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `;
        const testTables = (await testPool.query(tableQuery)).rows;
        const refTables = (await refPool.query(tableQuery)).rows;

        const testTableSet = new Set(testTables.map(t => `${t.table_schema}.${t.table_name}`));
        const refTableSet = new Set(refTables.map(t => `${t.table_schema}.${t.table_name}`));

        console.log(`\n=== TABLES ===`);
        console.log(`  Reference: ${refTableSet.size} tables`);
        console.log(`  Test:      ${testTableSet.size} tables`);

        const missingTables = [...refTableSet].filter(t => !testTableSet.has(t));
        const extraTables = [...testTableSet].filter(t => !refTableSet.has(t));

        if (missingTables.length) {
            console.log(`\n  ❌ Missing tables (${missingTables.length}):`);
            missingTables.forEach(t => console.log(`    - ${t}`));
        }
        if (extraTables.length) {
            console.log(`\n  ⚠️ Extra tables (${extraTables.length}):`);
            extraTables.forEach(t => console.log(`    - ${t}`));
        }
        if (!missingTables.length && !extraTables.length) {
            console.log('  ✅ All tables match!');
        }

        // Check key columns on patients_tenant
        console.log('\n=== KEY CHECKS ===');
        const ptCols = await testPool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'patients_tenant'
        `);
        const colNames = ptCols.rows.map(r => r.column_name);
        console.log(`  patients_tenant.master_patient_id: ${colNames.includes('master_patient_id') ? '✅' : '❌'}`);
        console.log(`  patients_tenant.global_patient_id: ${colNames.includes('global_patient_id') ? '❌ (should be gone)' : '✅ (correctly removed)'}`);

        // Check reference schema
        const refDocTypes = await testPool.query(`
            SELECT COUNT(*) as cnt FROM reference.identity_document_types
        `).catch(() => ({ rows: [{ cnt: 0 }] }));
        console.log(`  reference.identity_document_types: ${parseInt(refDocTypes.rows[0].cnt) > 0 ? '✅ (' + refDocTypes.rows[0].cnt + ' rows)' : '❌ empty'}`);

        // Check system locations
        const locs = await testPool.query(`SELECT name FROM locations WHERE scope = 'SYSTEM'`);
        const locNames = locs.rows.map(r => r.name);
        console.log(`  RETURN_QUARANTINE location: ${locNames.includes('RETURN_QUARANTINE') ? '✅' : '❌'}`);
        console.log(`  WASTE location: ${locNames.includes('WASTE') ? '✅' : '❌'}`);

        await testPool.end();
        await refPool.end();

        console.log('\n--- Simulation Complete ---');

    } catch (err: any) {
        console.error(`\n❌ Simulation Failed:`, err.message || err);
    } finally {
        await adminPool.end();
    }
}

simulateProvisioning();
