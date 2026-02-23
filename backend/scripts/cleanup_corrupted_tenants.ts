import { Pool } from 'pg';
import { globalQuery, getGlobalPool, closeGlobalPool } from '../db/globalPg';

// Connect as admin to system DB (postgres or sahty_emr) to run DROP DATABASE
const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_DB || 'sahty_emr'
});

async function main() {
    try {
        console.log("Looking for corrupted tenants 'uman' and 'hck'...");
        
        // 1. Find the tenants
        const corruptedTenants = await globalQuery(`
            SELECT id, designation 
            FROM tenants 
            WHERE designation ILIKE '%uman%' OR designation ILIKE '%hck%'
        `);
        
        if (corruptedTenants.length === 0) {
            console.log("No corrupted tenants found matching 'uman' or 'hck'.");
            process.exit(0);
        }

        console.log(`Found ${corruptedTenants.length} corrupted tenants to purge.`);

        // 2. Erase each tenant
        for (const tenant of corruptedTenants) {
            const tenantId = tenant.id.replace(/-/g, '_');
            const dbName = `tenant_${tenantId}`;
            console.log(`\nPurging tenant: ${tenant.designation} (${tenant.id})`);
            console.log(`Targeting Database: ${dbName}`);

            // Kick active connections to the database so we can drop it safely
            try {
                await adminPool.query(`
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = $1
                      AND pid <> pg_backend_pid();
                `, [dbName]);
                console.log(` -> Terminated active connections to ${dbName}.`);
            } catch (e: any) {
                console.log(` -> Failed to terminate connections: ${e.message}`);
            }

            // Drop the physical database
            try {
                await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}";`);
                console.log(` -> Physical database ${dbName} DROPPED.`);
            } catch (e: any) {
                console.log(` -> Database drop failed (maybe it didn't finish provisioning): ${e.message}`);
            }

            // Delete the entity from sahty_global.tenants
            try {
                await globalQuery(`DELETE FROM tenants WHERE id = $1`, [tenant.id]);
                console.log(` -> Removed ${tenant.designation} from sahty_global.tenants.`);
            } catch (e: any) {
                console.log(` -> Failed to remove global tenant record: ${e.message}`);
            }
        }

        console.log("\nCleanup Complete.");
    } catch (e) {
        console.error("Fatal Error during cleanup:", e);
    } finally {
        await adminPool.end();
        await closeGlobalPool();
    }
}

main();
