
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function runMigration() {
    try {
        console.log("Applying migration 019 to tenant " + TENANT_ID);
        
        await tenantQuery(TENANT_ID, `
            ALTER TABLE stock_returns DROP CONSTRAINT IF EXISTS stock_returns_status_check;
        `);

        await tenantQuery(TENANT_ID, `
            ALTER TABLE stock_returns ADD CONSTRAINT stock_returns_status_check 
            CHECK (status IN (
                'DRAFT', 
                'SUBMITTED', 
                'PARTIALLY_RECEIVED',
                'CANCELLED', 
                'CLOSED'
            ));
        `);

        console.log("Migration 019 applied successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

runMigration();
