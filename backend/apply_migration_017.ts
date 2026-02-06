
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2'; // Hardcoded from logs

async function runMigration() {
    try {
        console.log("Applying migration 017 to tenant " + TENANT_ID);
        
        await tenantQuery(TENANT_ID, `
            ALTER TABLE return_receptions
            ADD COLUMN IF NOT EXISTS reception_reference TEXT;
        `);

        await tenantQuery(TENANT_ID, `
            CREATE INDEX IF NOT EXISTS idx_return_receptions_reference ON return_receptions(reception_reference);
        `);

        console.log("Migration 017 applied successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

runMigration();
