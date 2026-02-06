
import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function runMigration() {
    try {
        console.log("Applying migration 018 to tenant " + TENANT_ID);
        
        await tenantQuery(TENANT_ID, `
            ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_document_type_check;
        `);

        await tenantQuery(TENANT_ID, `
            ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_document_type_check 
            CHECK (document_type IN (
                'DELIVERY_INJECTION',
                'TRANSFER',
                'DISPENSE',
                'RETURN_INTERNAL',
                'RETURN_SUPPLIER',
                'RETURN_RECEPTION',
                'WASTE',
                'DESTRUCTION',
                'BORROW_IN',
                'BORROW_OUT'
            ));
        `);

        console.log("Migration 018 applied successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

runMigration();
