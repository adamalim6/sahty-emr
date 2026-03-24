const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const TENANT_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/ced91ced-fe46-45d1-8ead-b5d51bad5895';

const GLOBAL_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/global/069_lab_panel_dual_model_global.sql';
const TENANT_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/tenant/086_lab_panel_dual_model_tenant.sql';

async function runMigrations() {
    console.log("Starting migrations...");

    // 1. Global DB
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    try {
        await globalClient.connect();
        const sql = fs.readFileSync(GLOBAL_MIGRATION, 'utf8');
        await globalClient.query(sql);
        console.log('✅ Successfully applied global migration: 069_lab_panel_dual_model_global.sql');
    } catch (err) {
        console.error('❌ Error executing global migration:', err.message);
        return;
    } finally {
        await globalClient.end();
    }

    // 2. Tenant DB
    const tenantClient = new Client({ connectionString: TENANT_DB });
    try {
        await tenantClient.connect();
        const sql = fs.readFileSync(TENANT_MIGRATION, 'utf8');
        await tenantClient.query(sql);
        console.log('✅ Successfully applied tenant migration: 086_lab_panel_dual_model_tenant.sql');
    } catch (err) {
        console.error('❌ Error executing tenant migration:', err.message);
    } finally {
        await tenantClient.end();
    }
}

runMigrations();
