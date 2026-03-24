const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const TENANT_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/tenant/091_lab_reference_system_refactor_tenant.sql';

async function runTenantMigrations() {
    console.log("Looking for tenant databases...");
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    
    let tenantDBs = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
        console.log(`Found ${tenantDBs.length} tenant databases.`, tenantDBs);
    } catch (err) {
        console.error('❌ Error finding databases:', err.message);
        return;
    } finally {
        await globalClient.end();
    }

    if (tenantDBs.length === 0) {
        console.log('No tenant databases found to migrate.');
        return;
    }

    const sql = fs.readFileSync(TENANT_MIGRATION, 'utf8');

    for (const dbName of tenantDBs) {
        const tenantString = `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}`;
        console.log(`\nMigrating tenant: ${dbName}...`);
        const tenantClient = new Client({ connectionString: tenantString });
        try {
            await tenantClient.connect();
            await tenantClient.query(sql);
            console.log(`✅ Successfully applied tenant migration to ${dbName}`);
        } catch (err) {
            console.error(`❌ Error executing tenant migration on ${dbName}:`, err.message);
        } finally {
            await tenantClient.end();
        }
    }
}

runTenantMigrations();
