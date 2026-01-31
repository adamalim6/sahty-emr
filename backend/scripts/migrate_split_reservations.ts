/**
 * Migration Script: Split stock_reservations into Header + Lines
 * 
 * Run with: npx ts-node backend/scripts/migrate_split_reservations.ts
 */

import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

async function runMigration() {
    console.log('[Migration] Starting stock_reservations split...\n');

    const clients = await globalQuery("SELECT id FROM clients");
    console.log(`[Migration] Found ${clients.length} tenants\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const client of clients) {
        const tenantId = client.id;
        console.log(`[Migration] Processing tenant: ${tenantId}`);

        let pgClient;
        try {
            const pool = getTenantPool(tenantId);
            pgClient = await pool.connect();

            // Check if migration already applied
            const tableCheck = await pgClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'stock_reservation_lines'
                ) as exists
            `);

            if (tableCheck.rows[0].exists) {
                console.log(`  → Already migrated, skipping`);
                pgClient.release();
                successCount++;
                continue;
            }

            // Check if stock_reservations exists
            const reservationsCheck = await pgClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'stock_reservations'
                ) as exists
            `);

            if (!reservationsCheck.rows[0].exists) {
                console.log(`  → No stock_reservations table, skipping`);
                pgClient.release();
                successCount++;
                continue;
            }

            await pgClient.query('BEGIN');

            // STEP 1: Create stock_reservation_lines table
            await pgClient.query(`
                CREATE TABLE stock_reservation_lines (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    reservation_id UUID NOT NULL,
                    tenant_id TEXT NOT NULL,
                    stock_demand_line_id UUID,
                    product_id UUID NOT NULL,
                    lot TEXT NOT NULL,
                    expiry DATE NOT NULL,
                    source_location_id UUID NOT NULL,
                    destination_location_id UUID,
                    qty_units INTEGER NOT NULL CHECK (qty_units > 0),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log(`  → Created stock_reservation_lines table`);

            // STEP 2: Create indexes
            await pgClient.query(`CREATE INDEX idx_resline_reservation ON stock_reservation_lines(reservation_id)`);
            await pgClient.query(`CREATE INDEX idx_resline_tenant ON stock_reservation_lines(tenant_id)`);
            await pgClient.query(`CREATE INDEX idx_resline_lookup ON stock_reservation_lines(product_id, lot, expiry, source_location_id)`);

            // STEP 3: Migrate existing data
            const hasData = await pgClient.query(`
                SELECT COUNT(*) as cnt FROM stock_reservations WHERE product_id IS NOT NULL
            `);
            
            if (parseInt(hasData.rows[0].cnt) > 0) {
                await pgClient.query(`
                    INSERT INTO stock_reservation_lines (
                        id, reservation_id, tenant_id, stock_demand_line_id, 
                        product_id, lot, expiry, source_location_id, destination_location_id, qty_units, created_at
                    )
                    SELECT 
                        gen_random_uuid(),
                        reservation_id,
                        tenant_id,
                        demand_line_id::UUID,
                        product_id,
                        COALESCE(lot, 'UNKNOWN'),
                        COALESCE(expiry, '2099-12-31'),
                        location_id::UUID,
                        destination_location_id::UUID,
                        qty_units,
                        COALESCE(reserved_at, NOW())
                    FROM stock_reservations
                    WHERE product_id IS NOT NULL
                `);
                console.log(`  → Migrated ${hasData.rows[0].cnt} existing reservations to lines`);
            }

            // STEP 4: Add FK constraint
            await pgClient.query(`
                ALTER TABLE stock_reservation_lines 
                ADD CONSTRAINT fk_resline_reservation 
                FOREIGN KEY (reservation_id) REFERENCES stock_reservations(reservation_id)
            `);

            // STEP 5: Add lineage columns to stock_transfers and stock_transfer_lines
            const transfersCheck = await pgClient.query(`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transfers') as exists
            `);
            if (transfersCheck.rows[0].exists) {
                await pgClient.query(`ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS stock_reservation_id UUID`);
                console.log(`  → Added stock_reservation_id to stock_transfers`);
            }

            const transferLinesCheck = await pgClient.query(`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transfer_lines') as exists
            `);
            if (transferLinesCheck.rows[0].exists) {
                await pgClient.query(`ALTER TABLE stock_transfer_lines ADD COLUMN IF NOT EXISTS reservation_line_id UUID`);
                console.log(`  → Added reservation_line_id to stock_transfer_lines`);
            }

            // STEP 6: Drop deprecated columns from stock_reservations header
            const columnsToDrop = [
                'transfer_id', 'transfer_line_id', 'client_request_id',
                'demand_line_id', 'product_id', 'lot', 'expiry', 
                'location_id', 'destination_location_id', 'qty_units'
            ];
            
            for (const col of columnsToDrop) {
                await pgClient.query(`ALTER TABLE stock_reservations DROP COLUMN IF EXISTS ${col}`);
            }
            console.log(`  → Cleaned up header columns`);

            // STEP 7: Rename cancelled_at to released_at (check if exists first)
            const cancelledAtCheck = await pgClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'stock_reservations' AND column_name = 'cancelled_at'
                ) as exists
            `);
            if (cancelledAtCheck.rows[0].exists) {
                await pgClient.query(`ALTER TABLE stock_reservations RENAME COLUMN cancelled_at TO released_at`);
                console.log(`  → Renamed cancelled_at to released_at`);
            }

            // STEP 8: Rename demand_id to stock_demand_id (check if exists first)
            const demandIdCheck = await pgClient.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'stock_reservations' AND column_name = 'demand_id'
                ) as exists
            `);
            if (demandIdCheck.rows[0].exists) {
                await pgClient.query(`ALTER TABLE stock_reservations RENAME COLUMN demand_id TO stock_demand_id`);
                console.log(`  → Renamed demand_id to stock_demand_id`);
            }

            // STEP 9: Update status constraint
            await pgClient.query(`ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_status_check`);
            await pgClient.query(`
                ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_status_check 
                CHECK (status IN ('ACTIVE', 'RELEASED', 'COMMITTED'))
            `);

            // STEP 10: Update any EXPIRED status to RELEASED
            await pgClient.query(`UPDATE stock_reservations SET status = 'RELEASED' WHERE status = 'EXPIRED'`);

            // STEP 11: Update indexes
            await pgClient.query(`DROP INDEX IF EXISTS idx_res_active`);
            await pgClient.query(`
                CREATE INDEX IF NOT EXISTS idx_res_session_active ON stock_reservations(tenant_id, session_id) 
                WHERE status = 'ACTIVE'
            `);

            await pgClient.query('COMMIT');
            console.log(`  ✓ Migration complete`);
            successCount++;

        } catch (error: any) {
            if (pgClient) {
                try { await pgClient.query('ROLLBACK'); } catch (e) {}
            }
            console.error(`  ✗ Error: ${error.message}`);
            errorCount++;
        } finally {
            if (pgClient) pgClient.release();
        }
    }

    console.log(`\n[Migration] Complete!`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);

    process.exit(errorCount > 0 ? 1 : 0);
}

runMigration().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
