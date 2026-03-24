const fs = require('fs');
const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const GLOBAL_MIGRATION = '/Users/adamalim/Desktop/copy-of-copy-of-sahty-emr-system/backend/migrations/pg/global/074_lab_reference_system_refactor_global.sql';

async function runGlobalMigration() {
    console.log("Running global migration 074...");
    const sql = fs.readFileSync(GLOBAL_MIGRATION, 'utf8');
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    
    try {
        await globalClient.connect();
        await globalClient.query(sql);
        console.log(`✅ Successfully applied global migration 074 to sahty_global`);
    } catch (err) {
        console.error('❌ Error executing global migration:', err.message);
    } finally {
        await globalClient.end();
    }
}

runGlobalMigration();
