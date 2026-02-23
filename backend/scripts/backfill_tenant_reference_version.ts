import { globalQuery, closeGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

async function main() {
    try {
        console.log("Starting Tenant Version Tracker Backfill...");

        // 1. Get all tenants
        const tenantsResult = await globalQuery('SELECT id, designation FROM tenants');
        console.log(`Found ${tenantsResult.length} tenants to backfill.`);

        // 2. Loop through each tenant and create/seed the table
        for (const tenant of tenantsResult) {
            console.log(`Processing Tenant: ${tenant.designation} (${tenant.id})`);
            const pool = getTenantPool(tenant.id);
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS public.reference_schema_version (
                        id              INTEGER PRIMARY KEY CHECK (id = 1),
                        current_version INTEGER NOT NULL,
                        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                    INSERT INTO public.reference_schema_version (id, current_version)
                    VALUES (1, 0)
                    ON CONFLICT (id) DO NOTHING;
                `);
                console.log(`  -> Successfully backfilled version tracker for ${tenant.id}`);
            } catch (err) {
                console.error(`  -> Error processing ${tenant.id}:`, err);
            }
        }

        console.log("Backfill complete.");
    } catch (e) {
        console.error("Fatal Error:", e);
    } finally {
        await closeGlobalPool();
        process.exit(0);
    }
}

main();
