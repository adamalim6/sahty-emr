
import { getTenantPool, tenantQuery } from '../db/tenantPg';
import { getTenants } from '../services/tenantService';

async function migrate() {
    console.log("Starting migration: Add destination_location_id to stock_demand_lines...");
    
    try {
        const tenants = await getTenants();
        console.log(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`Migrating tenant: ${tenant.id} (${tenant.name})...`);
            
            try {
                // Check if column exists
                const checkSql = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='stock_demand_lines' AND column_name='destination_location_id';
                `;
                const checkRes = await tenantQuery(tenant.id, checkSql);
                
                if (checkRes.length === 0) {
                    console.log(`  - Adding destination_location_id column...`);
                    await tenantQuery(tenant.id, `
                        ALTER TABLE stock_demand_lines 
                        ADD COLUMN destination_location_id UUID;
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
        process.exit(0); // Force exit to close pools
    }
}

migrate();
