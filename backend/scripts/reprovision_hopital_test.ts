/**
 * Re-provision the Hopital Test tenant database that was accidentally dropped.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { globalQuery, closeGlobalPool } from '../db/globalPg';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';

// Check the DB naming convention used by the codebase
const { getTenantDbName } = require('../db/tenantPg');
const dbName = getTenantDbName(TENANT_ID);

const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'postgres'
});

async function main() {
    try {
        console.log(`Re-provisioning Hopital Test DB: ${dbName}`);

        // Check if it exists
        const check = await adminPool.query(
            "SELECT 1 FROM pg_database WHERE datname = $1", [dbName]
        );

        if (check.rows.length > 0) {
            console.log(`Database ${dbName} already exists. Nothing to do.`);
            return;
        }

        // Create it
        await adminPool.query(`CREATE DATABASE "${dbName}"`);
        console.log(`[+] Database ${dbName} created.`);

        // Apply schema
        const pool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: dbName
        });

        // Phase 1: Baseline
        console.log(`[+] Phase 1: Baseline schema...`);
        const baselineFile = path.join(__dirname, '../migrations/pg/tenant/baseline_tenant_schema.sql');
        await pool.query(fs.readFileSync(baselineFile, 'utf-8'));
        console.log(`    PASSED`);

        // Phase 1.1: Identity Migrations
        console.log(`[+] Phase 1.1: Identity migrations...`);
        for (const migFile of ['040_refactor_identity_destructive.sql', '041_create_new_identity_tables.sql', '042_setup_sync_schema.sql', '043_fix_audit_trigger.sql']) {
            const migPath = path.join(__dirname, `../migrations/pg/tenant/${migFile}`);
            if (fs.existsSync(migPath)) {
                await pool.query(fs.readFileSync(migPath, 'utf-8'));
                console.log(`    Applied ${migFile}`);
            }
        }

        // Phase 2: System locations
        console.log(`[+] Phase 2: System locations...`);
        await pool.query(`
            INSERT INTO locations (
                location_id, tenant_id, name, type, scope,
                location_class, valuation_policy, service_id, status, created_at
            ) VALUES
            (gen_random_uuid(), $1, 'RETURN_QUARANTINE', 'VIRTUAL', 'SYSTEM',
             'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()),
            (gen_random_uuid(), $1, 'WASTE', 'VIRTUAL', 'SYSTEM',
             'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW())
            ON CONFLICT DO NOTHING
        `, [TENANT_ID]);
        console.log(`    PASSED`);

        // Phase 3: Reference Sync
        console.log(`[+] Phase 3: Reference Sync...`);
        const { syncTenantReference } = require('./referenceSync');
        await syncTenantReference(pool, TENANT_ID);
        console.log(`    PASSED`);

        // Phase 5: Auth Sync
        console.log(`[+] Phase 5: Auth Sync Schema...`);
        const authSyncFile = path.join(__dirname, '../migrations/pg/tenant/setup_auth_sync_tenant.sql');
        if (fs.existsSync(authSyncFile)) {
            await pool.query(fs.readFileSync(authSyncFile, 'utf-8'));
            console.log(`    PASSED`);
        }

        await pool.end();
        console.log(`\n=== Hopital Test re-provisioned successfully. ===`);
    } catch (e) {
        console.error("FATAL:", e);
    } finally {
        await adminPool.end();
        await closeGlobalPool();
    }
}

main();
