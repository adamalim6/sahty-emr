const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const GLOBAL_SQL_PATH = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/global/072_lab_specimen_containers_global.sql';
const TENANT_SQL_PATH = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/tenant/089_lab_specimen_containers_tenant.sql';

async function main() {
    const globalSql = fs.readFileSync(GLOBAL_SQL_PATH, 'utf8');
    const tenantSql = fs.readFileSync(TENANT_SQL_PATH, 'utf8');

    // 1. Execute Global Migration
    console.log("Applying Global Migration 072 on sahty_global...");
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    try {
        await globalClient.connect();
        await globalClient.query('BEGIN');
        await globalClient.query(globalSql);
        await globalClient.query('COMMIT');
        console.log("✅ Global migration applied.");
    } catch (e) {
        await globalClient.query('ROLLBACK');
        console.error("❌ Global migration failed:", e);
        await globalClient.end();
        process.exit(1);
    }
    
    // Find tenants
    let tenantDBs = [];
    try {
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
    } catch (err) {
        console.error('❌ Error finding tenant DBs', err.message);
        process.exit(1);
    } finally {
        await globalClient.end();
    }

    // 2. Execute Tenant Migrations
    for (const dbName of tenantDBs) {
        console.log(`\nApplying Tenant Migration 089 on ${dbName}...`);
        const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        try {
            await client.connect();
            await client.query('BEGIN');
            await client.query(tenantSql);
            await client.query('COMMIT');
            console.log(`✅ Tenant migration applied for ${dbName}.`);
        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Tenant migration failed on ${dbName}:`, e.message);
        } finally {
            await client.end();
        }
    }
}

main().catch(console.error);
