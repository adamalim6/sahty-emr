/**
 * Migration: Normalize inventory_movements.document_type
 * 
 * This script applies the document_type normalization to all existing tenant databases.
 * 
 * Canonical types:
 *   DELIVERY_INJECTION  - quarantine → stock
 *   TRANSFER            - internal transfer (pharmacy ↔ department)
 *   DISPENSE            - stock → patient/admission sink
 *   RETURN_INTERNAL     - ward/patient → pharmacy (replaces RETURN_WARD)
 *   RETURN_SUPPLIER     - pharmacy → supplier
 *   WASTE
 *   DESTRUCTION
 *   BORROW_IN
 *   BORROW_OUT
 * 
 * Run with: npx ts-node scripts/migrate_normalize_document_type.ts
 */

import { Pool } from 'pg';

const GLOBAL_DB_CONFIG = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_global'
};

async function main() {
    console.log('=== Normalizing inventory_movements.document_type ===\n');

    const globalPool = new Pool(GLOBAL_DB_CONFIG);

    try {
        // Get all tenant databases (clients table contains tenant IDs)
        const tenantsResult = await globalPool.query(`
            SELECT id as tenant_id FROM clients
        `);

        console.log(`Found ${tenantsResult.rows.length} active tenants\n`);

        for (const tenant of tenantsResult.rows) {
            const tenantDbName = `tenant_${tenant.tenant_id}`;
            console.log(`Processing tenant: ${tenantDbName}`);

            const tenantPool = new Pool({
                ...GLOBAL_DB_CONFIG,
                database: tenantDbName
            });

            try {
                // Step 1: Migrate existing rows to new canonical types
                console.log('  - Migrating TRANSFER_OUT/TRANSFER_IN/REPLENISHMENT → TRANSFER');
                const transferResult = await tenantPool.query(`
                    UPDATE inventory_movements 
                    SET document_type = 'TRANSFER' 
                    WHERE document_type IN ('TRANSFER_OUT', 'TRANSFER_IN', 'REPLENISHMENT')
                `);
                console.log(`    Updated ${transferResult.rowCount} rows`);

                console.log('  - Migrating RETURN_WARD → RETURN_INTERNAL');
                const returnResult = await tenantPool.query(`
                    UPDATE inventory_movements 
                    SET document_type = 'RETURN_INTERNAL' 
                    WHERE document_type = 'RETURN_WARD'
                `);
                console.log(`    Updated ${returnResult.rowCount} rows`);

                console.log('  - Migrating DELIVERY → DELIVERY_INJECTION');
                const deliveryResult = await tenantPool.query(`
                    UPDATE inventory_movements 
                    SET document_type = 'DELIVERY_INJECTION' 
                    WHERE document_type = 'DELIVERY'
                `);
                console.log(`    Updated ${deliveryResult.rowCount} rows`);

                // Step 2: Drop old CHECK constraint
                console.log('  - Dropping old CHECK constraint');
                await tenantPool.query(`
                    ALTER TABLE inventory_movements 
                    DROP CONSTRAINT IF EXISTS inventory_movements_document_type_check
                `);

                // Step 3: Create new CHECK constraint
                console.log('  - Creating new CHECK constraint with canonical types');
                await tenantPool.query(`
                    ALTER TABLE inventory_movements 
                    ADD CONSTRAINT inventory_movements_document_type_check 
                    CHECK (document_type IN (
                        'DELIVERY_INJECTION',
                        'TRANSFER',
                        'DISPENSE',
                        'RETURN_INTERNAL',
                        'RETURN_SUPPLIER',
                        'WASTE',
                        'DESTRUCTION',
                        'BORROW_IN',
                        'BORROW_OUT'
                    ))
                `);

                // Step 4: Verify
                console.log('  - Verifying document_type distribution:');
                const verifyResult = await tenantPool.query(`
                    SELECT document_type, COUNT(*) as count
                    FROM inventory_movements 
                    GROUP BY document_type
                    ORDER BY count DESC
                `);
                for (const row of verifyResult.rows) {
                    console.log(`    ${row.document_type}: ${row.count}`);
                }

                console.log(`  ✅ Tenant ${tenantDbName} completed\n`);

            } catch (err) {
                console.error(`  ❌ Error processing tenant ${tenantDbName}:`, err);
            } finally {
                await tenantPool.end();
            }
        }

        console.log('=== Migration Complete ===');

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    } finally {
        await globalPool.end();
    }
}

main();
