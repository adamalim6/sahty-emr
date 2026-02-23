/**
 * Purge ALL tenants EXCEPT hopital test (ced91ced-fe46-45d1-8ead-b5d51bad5895).
 * Drops their databases, removes their rows from sahty_global.tenants,
 * and removes associated users from sahty_global.users.
 */
import { Pool } from 'pg';
import { globalQuery, closeGlobalPool } from '../db/globalPg';

const KEEP_TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';

const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_DB || 'sahty_emr'
});

async function main() {
    try {
        // 1. Find all tenants to purge
        const tenants = await globalQuery(
            `SELECT id, designation FROM tenants WHERE id != $1`,
            [KEEP_TENANT_ID]
        );

        if (tenants.length === 0) {
            console.log("No tenants to purge (only hopital test exists).");
            return;
        }

        console.log(`Found ${tenants.length} tenants to purge (keeping hopital test):\n`);
        for (const t of tenants) {
            console.log(`  - ${t.designation} (${t.id})`);
        }
        console.log();

        for (const tenant of tenants) {
            const tenantId = tenant.id.replace(/-/g, '_');
            const dbName = `tenant_${tenantId}`;
            console.log(`\n=== Purging: ${tenant.designation} (${tenant.id}) ===`);

            // Terminate active connections
            try {
                await adminPool.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = $1 AND pid <> pg_backend_pid()
                `, [dbName]);
                console.log(`  [+] Terminated connections to ${dbName}`);
            } catch (e: any) {
                console.log(`  [-] No connections to terminate: ${e.message}`);
            }

            // Drop the database
            try {
                await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
                console.log(`  [+] Dropped database ${dbName}`);
            } catch (e: any) {
                console.log(`  [-] Could not drop database: ${e.message}`);
            }

            // Remove associated users from sahty_global.users (if any)
            try {
                const deleted = await globalQuery(
                    `DELETE FROM users WHERE tenant_id = $1 RETURNING username`,
                    [tenant.id]
                );
                console.log(`  [+] Removed ${deleted.length} user(s) from sahty_global.users`);
            } catch (e: any) {
                console.log(`  [-] No users table or column to clean: ${e.message}`);
            }

            // Remove the tenant row
            try {
                await globalQuery(`DELETE FROM tenants WHERE id = $1`, [tenant.id]);
                console.log(`  [+] Removed tenant row from sahty_global.tenants`);
            } catch (e: any) {
                console.log(`  [-] Could not remove tenant row: ${e.message}`);
            }
        }

        // Final verification
        const remaining = await globalQuery(`SELECT id, designation FROM tenants`);
        console.log(`\n=== FINAL STATE ===`);
        console.log(`Remaining tenants: ${remaining.length}`);
        for (const t of remaining) {
            console.log(`  - ${t.designation} (${t.id})`);
        }

    } catch (e) {
        console.error("Fatal Error:", e);
    } finally {
        await adminPool.end();
        await closeGlobalPool();
    }
}

main();
