/**
 * reset_test_groups.ts
 * 
 * DEV-ONLY script: Drops all group databases and deletes all group rows.
 * Usage: npx ts-node scripts/reset_test_groups.ts
 */

import { Pool } from 'pg';
import { globalQuery } from '../db/globalPg';

async function main() {
    console.log('=== Reset Test Groups (DEV ONLY) ===\n');

    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: process.env.PG_DB || 'sahty_emr'
    });

    // 1. Fetch all groups
    const groups = await globalQuery<{ id: string; name: string; db_name: string | null }>('SELECT id, name, db_name FROM public.groups');
    console.log(`Found ${groups.length} group(s) to clean up.\n`);

    for (const group of groups) {
        console.log(`→ Group: "${group.name}" (${group.id})`);

        // Also check for old naming convention (group_auth_*)
        const safeId = group.id.replace(/-/g, '_');
        const possibleDbNames = [
            group.db_name,
            `group_${safeId}`,
            `group_auth_${safeId}`
        ].filter(Boolean) as string[];

        // Deduplicate
        const uniqueDbNames = [...new Set(possibleDbNames)];

        for (const dbName of uniqueDbNames) {
            try {
                const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
                if (exists.rows.length > 0) {
                    // Terminate connections before dropping
                    await adminPool.query(`
                        SELECT pg_terminate_backend(pid) 
                        FROM pg_stat_activity 
                        WHERE datname = $1 AND pid <> pg_backend_pid()
                    `, [dbName]);
                    await adminPool.query(`DROP DATABASE "${dbName}"`);
                    console.log(`  ✅ Dropped database: ${dbName}`);
                } else {
                    console.log(`  ⏭  Database not found: ${dbName}`);
                }
            } catch (err: any) {
                console.error(`  ❌ Failed to drop ${dbName}: ${err.message}`);
            }
        }

        // Delete the group row
        await globalQuery('DELETE FROM public.groups WHERE id = $1', [group.id]);
        console.log(`  ✅ Deleted group row\n`);
    }

    console.log('=== Cleanup complete ===');
    await adminPool.end();
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
