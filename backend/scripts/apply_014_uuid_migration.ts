/**
 * Migration 014: Fix stock_demands schema - Convert TEXT columns to UUID
 * First fixes any invalid data (usernames instead of UUIDs), then converts columns
 */

import { globalAdminService } from '../services/globalAdminService';
import { tenantQuery, closeAllTenantPools } from '../db/tenantPg';
import { closeGlobalPool } from '../db/globalPg';

async function migrate() {
    console.log("Starting migration 014 (stock_demands UUID Schema Fix)...\n");
    
    try {
        const clients = await globalAdminService.getAllClients();
        console.log(`Found ${clients.length} tenants.\n`);

        for (const client of clients) {
            console.log(`\n=== Migrating tenant: ${client.id} (${client.designation}) ===`);
            try {
                // Step 1: Fix invalid data in requested_by (usernames instead of UUIDs)
                console.log("  1. Fixing invalid requested_by values...");
                const badRows = await tenantQuery(client.id, `
                    SELECT id, requested_by 
                    FROM stock_demands 
                    WHERE requested_by IS NOT NULL 
                      AND requested_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                `);
                
                for (const row of badRows) {
                    const username = row.requested_by;
                    // Look up user by username
                    const userResult = await tenantQuery(client.id, 
                        `SELECT id FROM users WHERE username = $1`, [username]);
                    
                    if (userResult.length > 0) {
                        console.log(`     Found user '${username}' -> ${userResult[0].id}`);
                        await tenantQuery(client.id, 
                            `UPDATE stock_demands SET requested_by = $1 WHERE id = $2`, 
                            [userResult[0].id, row.id]);
                    } else {
                        console.log(`     User '${username}' not found, setting to NULL`);
                        await tenantQuery(client.id, 
                            `UPDATE stock_demands SET requested_by = NULL WHERE id = $1`, 
                            [row.id]);
                    }
                }
                if (badRows.length === 0) console.log("     No invalid values found");

                // Step 2: Convert tenant_id from TEXT to UUID
                console.log("  2. Converting tenant_id to UUID...");
                await tenantQuery(client.id, `
                    ALTER TABLE stock_demands 
                    ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid
                `);

                // Step 3: Convert service_id from TEXT to UUID
                console.log("  3. Converting service_id to UUID...");
                await tenantQuery(client.id, `
                    ALTER TABLE stock_demands 
                    ALTER COLUMN service_id TYPE UUID USING service_id::uuid
                `);

                // Step 4: Convert assigned_user_id from TEXT to UUID (nullable)
                console.log("  4. Converting assigned_user_id to UUID...");
                await tenantQuery(client.id, `
                    ALTER TABLE stock_demands 
                    ALTER COLUMN assigned_user_id TYPE UUID USING 
                        CASE WHEN assigned_user_id IS NULL OR assigned_user_id = '' 
                             THEN NULL 
                             ELSE assigned_user_id::uuid 
                        END
                `);

                // Step 5: Convert requested_by from TEXT to UUID (nullable)
                console.log("  5. Converting requested_by to UUID...");
                await tenantQuery(client.id, `
                    ALTER TABLE stock_demands 
                    ALTER COLUMN requested_by TYPE UUID USING 
                        CASE WHEN requested_by IS NULL OR requested_by = '' 
                             THEN NULL 
                             ELSE requested_by::uuid 
                        END
                `);

                // Step 6: Also fix stock_demand_lines.tenant_id if needed
                console.log("  6. Fixing stock_demand_lines.tenant_id...");
                await tenantQuery(client.id, `
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'stock_demand_lines' 
                            AND column_name = 'tenant_id' 
                            AND data_type = 'text'
                        ) THEN
                            ALTER TABLE stock_demand_lines 
                            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
                        END IF;
                    END $$;
                `);

                console.log(`  ✅ Success: ${client.designation}`);
            } catch (e: any) {
                console.error(`  ❌ Failed: ${client.designation} - ${e.message}`);
            }
        }
    } catch (err: any) {
        console.error("Migration fatal error:", err);
    } finally {
        await closeAllTenantPools();
        await closeGlobalPool();
        console.log("\n\nMigration complete.");
        process.exit(0);
    }
}

migrate();
