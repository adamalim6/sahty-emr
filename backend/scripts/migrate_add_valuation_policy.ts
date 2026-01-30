/**
 * Migration: Add valuation_policy column and RETURN_QUARANTINE location
 * 
 * Run with: npx ts-node backend/scripts/migrate_add_valuation_policy.ts
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

async function migrate(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRATION: Add valuation_policy & RETURN_QUARANTINE      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const tenantDbs = await getAllTenantDatabases();
    console.log(`Found ${tenantDbs.length} tenant database(s)\n`);

    for (const dbName of tenantDbs) {
        console.log(`\n📦 Processing: ${dbName}`);
        const pool = new Pool({ ...config, database: dbName });
        const tenantId = dbName.replace('tenant_', '');

        try {
            // Step 1: Add valuation_policy column if not exists
            const colCheck = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'locations' AND column_name = 'valuation_policy'
            `);

            if (colCheck.rows.length === 0) {
                console.log(`   Adding valuation_policy column...`);
                await pool.query(`
                    ALTER TABLE locations 
                    ADD COLUMN valuation_policy TEXT NOT NULL DEFAULT 'VALUABLE'
                    CHECK (valuation_policy IN ('VALUABLE', 'NON_VALUABLE'))
                `);
                console.log(`   ✅ Column added`);
            } else {
                console.log(`   ✓ valuation_policy column already exists`);
            }

            // Step 2: Set CHARITY locations to NON_VALUABLE
            const charityUpdate = await pool.query(`
                UPDATE locations 
                SET valuation_policy = 'NON_VALUABLE' 
                WHERE location_class = 'CHARITY' AND valuation_policy = 'VALUABLE'
            `);
            if (charityUpdate.rowCount && charityUpdate.rowCount > 0) {
                console.log(`   ✅ Updated ${charityUpdate.rowCount} CHARITY location(s) to NON_VALUABLE`);
            }

            // Step 3: Add RETURN_QUARANTINE constraint if not exists
            try {
                await pool.query(`
                    ALTER TABLE locations
                    ADD CONSTRAINT chk_return_quarantine_active
                    CHECK (NOT (name = 'RETURN_QUARANTINE' AND status != 'ACTIVE'))
                `);
                console.log(`   ✅ Added RETURN_QUARANTINE constraint`);
            } catch (e: any) {
                if (e.message.includes('already exists')) {
                    console.log(`   ✓ RETURN_QUARANTINE constraint already exists`);
                } else {
                    throw e;
                }
            }

            // Step 4: Create RETURN_QUARANTINE location if not exists
            const rqCheck = await pool.query(`
                SELECT location_id FROM locations WHERE name = 'RETURN_QUARANTINE' AND tenant_id = $1
            `, [tenantId]);

            if (rqCheck.rows.length === 0) {
                await pool.query(`
                    INSERT INTO locations (
                        location_id, tenant_id, name, type, scope, 
                        location_class, valuation_policy, service_id, status, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, 'RETURN_QUARANTINE', 'VIRTUAL', 'PHARMACY',
                        'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()
                    )
                `, [tenantId]);
                console.log(`   ✅ Created RETURN_QUARANTINE location`);
            } else {
                // Ensure it has correct valuation_policy
                await pool.query(`
                    UPDATE locations 
                    SET valuation_policy = 'NON_VALUABLE', type = 'VIRTUAL', scope = 'PHARMACY'
                    WHERE name = 'RETURN_QUARANTINE' AND tenant_id = $1
                `, [tenantId]);
                console.log(`   ✓ RETURN_QUARANTINE already exists (updated valuation_policy)`);
            }

            // Step 5: Ensure DISPENSED locations are NON_VALUABLE
            const dispensedUpdate = await pool.query(`
                UPDATE locations 
                SET valuation_policy = 'NON_VALUABLE' 
                WHERE name = 'DISPENSED' OR name LIKE '%Dispensed%'
            `);
            if (dispensedUpdate.rowCount && dispensedUpdate.rowCount > 0) {
                console.log(`   ✅ Set ${dispensedUpdate.rowCount} DISPENSED location(s) to NON_VALUABLE`);
            }

        } catch (err: any) {
            console.error(`   ❌ Error: ${err.message}`);
        } finally {
            await pool.end();
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     MIGRATION COMPLETE                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
