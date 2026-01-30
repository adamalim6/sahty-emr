/**
 * Migration: Add target_stock_location_id to stock_demand_lines
 * 
 * This column stores the business intent (where the requester wants stock to go).
 * During fulfillment, this value is copied to stock_transfer_lines.destination_location_id.
 */
import { globalQuery } from '../../db/globalPg';
import { tenantQuery } from '../../db/tenantPg';

async function migrate() {
    console.log("Starting migration: Add target_stock_location_id to stock_demand_lines...");
    
    try {
        // Get all tenants from global DB
        const tenants = await globalQuery('SELECT id, designation FROM clients');
        console.log(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`Migrating tenant: ${tenant.id} (${tenant.designation})...`);
            
            try {
                // Check if column already exists
                const checkSql = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='stock_demand_lines' AND column_name='target_stock_location_id';
                `;
                const checkRes = await tenantQuery(tenant.id, checkSql);
                
                if (checkRes.length === 0) {
                    console.log(`  - Adding target_stock_location_id column...`);
                    await tenantQuery(tenant.id, `
                        ALTER TABLE stock_demand_lines 
                        ADD COLUMN target_stock_location_id UUID;
                    `);
                    console.log(`  - SUCCESS`);
                } else {
                    console.log(`  - Column already exists. Skipping.`);
                }

            } catch (err) {
                console.error(`  - FAILED to migrate tenant ${tenant.id}:`, err);
            }
        }
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        console.log("Migration complete.");
        process.exit(0);
    }
}

migrate();
