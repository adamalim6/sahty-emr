
import { Pool } from 'pg';
import { globalQuery } from '../db/globalPg';

const REF_TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

// Admin Pool to drop databases
const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_DB || 'sahty_global' 
});

async function dropDatabase(dbName: string) {
    try {
        // terminate connections first
        await adminPool.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [dbName]);

        await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`✅ Dropped database: ${dbName}`);
    } catch (err: any) {
        console.error(`❌ Failed to drop database ${dbName}: ${err.message}`);
    }
}

async function run() {
    console.log(`🚨 STARTING CLEANUP (Preserving: ${REF_TENANT_ID}) 🚨`);

    try {
        // 1. Tenants
        const tenants = await globalQuery(`
            SELECT id, type, designation FROM public.tenants 
            WHERE id != $1
        `, [REF_TENANT_ID]);

        console.log(`Found ${tenants.length} tenants to remove.`);

        for (const t of tenants) {
            console.log(`\nRemoving Tenant: ${t.designation} (${t.id})`);
            
            // A. Drop DB
            const dbName = `tenant_${t.id}`;
            await dropDatabase(dbName);

            // B. Delete from Global Tables
            // Users first (FK)
            await globalQuery(`DELETE FROM public.users WHERE client_id = $1`, [t.id]);
            // Tenant
            await globalQuery(`DELETE FROM public.tenants WHERE id = $1`, [t.id]);
            
            console.log(`✅ Removed tenant records from Global DB.`);
        }

        // 2. Groups
        // We delete ALL groups? The user said "drop all existing tenants and groups".
        // Is the reference tenant inside a group?
        // We should probably check if the reference tenant belongs to a group and preserve it if so.
        // But the user said "drop all... for the exception of [tenant_id]".
        // Usually, reference tenant is standalone.
        // Let's check if the reference tenant has a group_id just to be safe.
        
        const refTenant = await globalQuery(`SELECT group_id FROM public.tenants WHERE id = $1`, [REF_TENANT_ID]);
        const preservedGroupId = refTenant[0]?.group_id;

        let groupsSql = `SELECT id, name FROM public.groups`;
        const groupsParams: any[] = [];
        
        if (preservedGroupId) {
            console.log(`ℹ️ Reference Tenant belongs to Group: ${preservedGroupId}. Preserving this group.`);
            groupsSql += ` WHERE id != $1`;
            groupsParams.push(preservedGroupId);
        }

        const groups = await globalQuery(groupsSql, groupsParams);

        console.log(`\nFound ${groups.length} groups to remove.`);

        for (const g of groups) {
            console.log(`\nRemoving Group: ${g.name} (${g.id})`);

            // A. Drop DB
            const safeId = g.id.replace(/-/g, '_');
            const dbName = `group_${safeId}`;
            await dropDatabase(dbName);

            // B. Delete from Global DB
            await globalQuery(`DELETE FROM public.groups WHERE id = $1`, [g.id]);
            console.log(`✅ Removed group records from Global DB.`);
        }

        console.log(`\n✨ CLEANUP COMPLETE ✨`);

    } catch (err: any) {
        console.error(`\n❌ FATAL ERROR: ${err.message}`);
    } finally {
        await adminPool.end();
        // Global pool is managed by globalPg, we might need to close it if the script hangs,
        // but explicit exit works too.
        process.exit(0);
    }
}

run();
