/**
 * Force-drop orphaned tenant databases that were left behind.
 * Terminates ALL connections first, then drops.
 */
import { Pool } from 'pg';

const KEEP_DB = 'tenant_ced91ced_fe46_45d1_8ead_b5d51bad5895'; // hopital test

const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'postgres' // Use postgres DB to avoid self-blocking
});

async function main() {
    try {
        // Find all tenant_ databases
        const dbs = await adminPool.query(`
            SELECT datname FROM pg_database 
            WHERE datname LIKE 'tenant_%' 
            AND datname != $1
            ORDER BY datname
        `, [KEEP_DB]);

        if (dbs.rows.length === 0) {
            console.log("No orphaned tenant databases found.");
            return;
        }

        console.log(`Found ${dbs.rows.length} tenant databases to drop:\n`);
        for (const row of dbs.rows) {
            console.log(`  - ${row.datname}`);
        }
        console.log();

        for (const row of dbs.rows) {
            const dbName = row.datname;
            console.log(`=== Dropping ${dbName} ===`);

            // Force-terminate ALL connections
            const terminated = await adminPool.query(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [dbName]);
            console.log(`  [+] Terminated ${terminated.rowCount} connection(s)`);

            // Revoke future connections
            await adminPool.query(`REVOKE CONNECT ON DATABASE "${dbName}" FROM PUBLIC`);

            // Drop
            try {
                await adminPool.query(`DROP DATABASE "${dbName}"`);
                console.log(`  [+] DROPPED successfully`);
            } catch (e: any) {
                console.error(`  [-] DROP FAILED: ${e.message}`);
                // Try with FORCE (PG 13+)
                try {
                    await adminPool.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
                    console.log(`  [+] DROPPED with FORCE`);
                } catch (e2: any) {
                    console.error(`  [-] FORCE DROP also FAILED: ${e2.message}`);
                }
            }
        }

        // Verify
        const remaining = await adminPool.query(`
            SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' ORDER BY datname
        `);
        console.log(`\n=== Remaining tenant databases ===`);
        for (const row of remaining.rows) {
            console.log(`  - ${row.datname}`);
        }
    } catch (e) {
        console.error("Fatal:", e);
    } finally {
        await adminPool.end();
    }
}

main();
