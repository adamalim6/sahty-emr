
import { tenantQuery } from './db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';
const MIGRATION_FILE = path.join(__dirname, '../migrations/pg/tenant/020_return_decisions_update.sql');

async function runMigration() {
    try {
        console.log("Applying migration 020 to tenant " + TENANT_ID);
        
        const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
        await tenantQuery(TENANT_ID, sql);

        console.log("Migration 020 applied successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

runMigration();
