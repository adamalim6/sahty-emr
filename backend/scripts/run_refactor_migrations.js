const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const GLOBAL_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/global/070_lab_analyte_units_refactor_global.sql';
const TENANT_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/tenant/087_lab_analyte_units_refactor_tenant.sql';

async function runMigrations() {
    const globalSql = fs.readFileSync(GLOBAL_MIGRATION, 'utf8');
    const tenantSql = fs.readFileSync(TENANT_MIGRATION, 'utf8');

    const globalClient = new Client({ connectionString: GLOBAL_DB });
    let tenantDBs = [];

    // Apply Global
    try {
        await globalClient.connect();
        console.log("Applying global migration to sahty_global...");
        await globalClient.query(globalSql);
        console.log("✅ Successfully applied global migration.");

        // Fetch tenants
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
        console.log(`Found ${tenantDBs.length} tenant databases:`, tenantDBs);
    } catch (err) {
        console.error('❌ Error executing global migration or fetching tenants:', err.message);
        return;
    } finally {
        await globalClient.end();
    }

    // Apply Tenants
    for (const dbName of tenantDBs) {
        const tenantString = `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}`;
        console.log(`\nMigrating tenant: ${dbName}...`);
        const tenantClient = new Client({ connectionString: tenantString });
        try {
            await tenantClient.connect();
            await tenantClient.query(tenantSql);
            console.log(`✅ Successfully applied tenant migration to ${dbName}`);
        } catch (err) {
            console.error(`❌ Error executing tenant migration on ${dbName}:`, err.message);
        } finally {
            await tenantClient.end();
        }
    }
}

runMigrations();
