/**
 * Migration: Remove redundant is_active column from locations table
 * 
 * The `status` column (TEXT: 'ACTIVE'/'INACTIVE') is the authoritative column.
 * The `is_active` column (BOOLEAN) is redundant and should be removed.
 * 
 * Run with: npx ts-node backend/scripts/migrate_drop_locations_is_active.ts
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

async function migrateDropIsActive(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRATION: Drop is_active column from locations          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const tenantDbs = await getAllTenantDatabases();
    console.log(`Found ${tenantDbs.length} tenant database(s)\n`);

    let totalDropped = 0;

    for (const dbName of tenantDbs) {
        console.log(`\n📦 Processing: ${dbName}`);
        const tenantPool = new Pool({ ...config, database: dbName });

        try {
            // Check if column exists
            const columnCheck = await tenantPool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'locations' AND column_name = 'is_active'
            `);

            if (columnCheck.rows.length === 0) {
                console.log(`   ✓ Column is_active already removed - skipping`);
                continue;
            }

            // First, drop any triggers that reference is_active
            console.log(`   Dropping triggers that reference is_active...`);
            await tenantPool.query(`DROP TRIGGER IF EXISTS trg_prevent_system_location_deactivate ON locations`);
            
            // Drop the column
            console.log(`   Dropping is_active column...`);
            await tenantPool.query(`ALTER TABLE locations DROP COLUMN is_active`);
            
            console.log(`   ✅ Column is_active dropped successfully`);
            totalDropped++;

            // Recreate the deactivation trigger using status column
            console.log(`   Recreating deactivation trigger using status column...`);
            await tenantPool.query(`
                CREATE OR REPLACE FUNCTION prevent_system_location_deactivate()
                RETURNS trigger AS $$
                BEGIN
                    IF (OLD.scope = 'SYSTEM' OR OLD.is_system = true) AND NEW.status = 'INACTIVE' THEN
                        RAISE EXCEPTION 'Cannot deactivate SYSTEM locations (tenant_id=%, code=%)', OLD.tenant_id, OLD.code;
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            `);
            
            await tenantPool.query(`
                CREATE TRIGGER trg_prevent_system_location_deactivate
                BEFORE UPDATE OF status ON locations
                FOR EACH ROW
                EXECUTE FUNCTION prevent_system_location_deactivate()
            `);
            console.log(`   ✅ Trigger recreated for status column`);

        } catch (err: any) {
            console.error(`   ❌ Error processing ${dbName}: ${err.message}`);
        } finally {
            await tenantPool.end();
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log(`║     MIGRATION COMPLETE: ${totalDropped} database(s) updated                  `.slice(0, 64) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
}

// Run
migrateDropIsActive()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
