/**
 * Migration: Convert location type from SHELF to PHYSICAL
 * 
 * This script updates all existing locations with type='SHELF' to type='PHYSICAL'.
 * The PHYSICAL type is the correct designation for physical stock locations.
 * 
 * Run with: npx ts-node backend/scripts/migrate_location_type_to_physical.ts
 */

import { Pool } from 'pg';

const config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
};

async function getAllTenantDatabases(): Promise<string[]> {
    const adminPool = new Pool({ ...config, database: 'postgres' });
    try {
        const result = await adminPool.query(`
            SELECT datname FROM pg_database 
            WHERE datname LIKE 'tenant_%' AND datistemplate = false
        `);
        return result.rows.map(r => r.datname);
    } finally {
        await adminPool.end();
    }
}

async function migrateLocationTypes(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRATION: Location Type SHELF → PHYSICAL                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const tenantDbs = await getAllTenantDatabases();
    console.log(`Found ${tenantDbs.length} tenant database(s)\n`);

    let totalUpdated = 0;

    for (const dbName of tenantDbs) {
        console.log(`\n📦 Processing: ${dbName}`);
        const tenantPool = new Pool({ ...config, database: dbName });

        try {
            // Check count before
            const beforeResult = await tenantPool.query(`
                SELECT COUNT(*) as count FROM locations WHERE type = 'SHELF'
            `);
            const beforeCount = parseInt(beforeResult.rows[0].count);

            if (beforeCount === 0) {
                console.log(`   ✓ No SHELF locations found - skipping`);
                continue;
            }

            console.log(`   Found ${beforeCount} location(s) with type='SHELF'`);

            // Perform the update
            const updateResult = await tenantPool.query(`
                UPDATE locations 
                SET type = 'PHYSICAL' 
                WHERE type = 'SHELF'
                RETURNING location_id, name
            `);

            console.log(`   ✅ Updated ${updateResult.rowCount} location(s) to type='PHYSICAL':`);
            updateResult.rows.forEach(row => {
                console.log(`      - ${row.name} (${row.location_id})`);
            });

            totalUpdated += updateResult.rowCount || 0;
        } catch (err: any) {
            console.error(`   ❌ Error processing ${dbName}: ${err.message}`);
        } finally {
            await tenantPool.end();
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log(`║     MIGRATION COMPLETE: ${totalUpdated} location(s) updated                   `.slice(0, 64) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
}

// Run
migrateLocationTypes()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
