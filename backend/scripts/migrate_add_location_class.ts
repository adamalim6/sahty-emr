/**
 * Migration: Add location_class column to locations table
 * 
 * This script:
 * 1. Adds location_class column to the locations table (if not exists)
 * 2. Sets all existing locations to 'COMMERCIAL' by default
 * 
 * Run with: npx ts-node backend/scripts/migrate_add_location_class.ts
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

async function migrateAddLocationClass(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRATION: Add location_class column to locations        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const tenantDbs = await getAllTenantDatabases();
    console.log(`Found ${tenantDbs.length} tenant database(s)\n`);

    let totalUpdated = 0;

    for (const dbName of tenantDbs) {
        console.log(`\n📦 Processing: ${dbName}`);
        const tenantPool = new Pool({ ...config, database: dbName });

        try {
            // Check if column exists
            const columnCheck = await tenantPool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'locations' AND column_name = 'location_class'
            `);

            if (columnCheck.rows.length > 0) {
                console.log(`   ✓ Column location_class already exists`);
                
                // Update any NULL values to COMMERCIAL
                const updateResult = await tenantPool.query(`
                    UPDATE locations 
                    SET location_class = 'COMMERCIAL' 
                    WHERE location_class IS NULL
                    RETURNING location_id, name
                `);
                
                if (updateResult.rowCount && updateResult.rowCount > 0) {
                    console.log(`   ✅ Updated ${updateResult.rowCount} location(s) with NULL to 'COMMERCIAL'`);
                    totalUpdated += updateResult.rowCount;
                }
            } else {
                console.log(`   Adding location_class column...`);
                
                // Add the column with default COMMERCIAL
                await tenantPool.query(`
                    ALTER TABLE locations 
                    ADD COLUMN location_class TEXT CHECK (location_class IN ('COMMERCIAL', 'CHARITY')) DEFAULT 'COMMERCIAL'
                `);
                
                // Update all existing rows to COMMERCIAL
                const updateResult = await tenantPool.query(`
                    UPDATE locations 
                    SET location_class = 'COMMERCIAL' 
                    WHERE location_class IS NULL
                    RETURNING location_id, name
                `);
                
                console.log(`   ✅ Column added and ${updateResult.rowCount || 0} location(s) set to 'COMMERCIAL'`);
                totalUpdated += updateResult.rowCount || 0;
            }

            // Show current state
            const summary = await tenantPool.query(`
                SELECT location_class, COUNT(*) as count 
                FROM locations 
                GROUP BY location_class
            `);
            
            if (summary.rows.length > 0) {
                console.log(`   📊 Current distribution:`);
                summary.rows.forEach(row => {
                    console.log(`      - ${row.location_class || 'NULL'}: ${row.count} location(s)`);
                });
            }
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
migrateAddLocationClass()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
