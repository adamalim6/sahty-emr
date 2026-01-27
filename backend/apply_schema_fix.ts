
import { getTenantPool } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function main() {
    try {
        console.log(`Applying schema fix for tenant ${TENANT_ID}...`);
        const pool = getTenantPool(TENANT_ID);

        // 1. Fix stock_reservations
        console.log('--- Checking stock_reservations ---');
        await pool.query(`
            ALTER TABLE stock_reservations 
            ADD COLUMN IF NOT EXISTS destination_location_id TEXT;
        `);
        console.log('✅ Added destination_location_id to stock_reservations');

        // 2. Fix stock_transfer_lines
        console.log('--- Checking stock_transfer_lines ---');
        await pool.query(`
            ALTER TABLE stock_transfer_lines 
            ADD COLUMN IF NOT EXISTS source_location_id TEXT,
            ADD COLUMN IF NOT EXISTS destination_location_id TEXT;
        `);
        console.log('✅ Added location columns to stock_transfer_lines');

        // 3. Fix stock_transfers (client_request_id)
        console.log('--- Checking stock_transfers ---');
        await pool.query(`
            ALTER TABLE stock_transfers 
            ADD COLUMN IF NOT EXISTS client_request_id TEXT;
        `);
        console.log('✅ Added client_request_id to stock_transfers');

        console.log('Schema patch complete.');

    } catch (e: any) {
        console.error('❌ Error applying schema fix:', e.message);
    }
}

main();
