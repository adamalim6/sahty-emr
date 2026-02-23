/**
 * Diagnostic script: simulates the exact provisioning flow against a throwaway DB
 * to capture the precise error.
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const adminPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_DB || 'sahty_emr'
});

const TEST_DB = 'tenant_diag_test_deleteme';

async function main() {
    try {
        // 0. Drop if exists
        await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
        console.log(`[Diag] Creating ${TEST_DB}...`);
        await adminPool.query(`CREATE DATABASE "${TEST_DB}"`);

        const pool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: TEST_DB
        });

        // PHASE 1: Baseline
        console.log(`[Diag] Phase 1: Baseline schema...`);
        const baselineFile = path.join(__dirname, '../migrations/pg/tenant/baseline_tenant_schema.sql');
        const baselineSql = fs.readFileSync(baselineFile, 'utf-8');
        await pool.query(baselineSql);
        console.log(`[Diag] Phase 1 PASSED.`);

        // PHASE 1.1: Identity Migrations
        console.log(`[Diag] Phase 1.1: Identity migrations...`);
        const identityMigrations = [
            '040_refactor_identity_destructive.sql',
            '041_create_new_identity_tables.sql',
            '042_setup_sync_schema.sql',
            '043_fix_audit_trigger.sql'
        ];
        for (const migFile of identityMigrations) {
            const migPath = path.join(__dirname, `../migrations/pg/tenant/${migFile}`);
            if (fs.existsSync(migPath)) {
                console.log(`[Diag]   Applying ${migFile}...`);
                const sql = fs.readFileSync(migPath, 'utf-8');
                await pool.query(sql);
            } else {
                console.log(`[Diag]   MISSING: ${migFile}`);
            }
        }
        console.log(`[Diag] Phase 1.1 PASSED.`);

        // PHASE 3: Reference Sync
        console.log(`[Diag] Phase 3: Reference Sync...`);
        try {
            const { syncTenantReference } = require('./referenceSync');
            await syncTenantReference(pool, 'diag-test-id');
            console.log(`[Diag] Phase 3 PASSED.`);
        } catch (e: any) {
            console.error(`[Diag] Phase 3 FAILED:`, e.message);
            console.error(e.stack);
        }

        // PHASE 5: Auth Sync Schema
        console.log(`[Diag] Phase 5: Auth Sync Schema...`);
        try {
            const authSyncFile = path.join(__dirname, '../migrations/pg/tenant/setup_auth_sync_tenant.sql');
            if (fs.existsSync(authSyncFile)) {
                const authSyncSql = fs.readFileSync(authSyncFile, 'utf-8');
                await pool.query(authSyncSql);
                console.log(`[Diag] Phase 5 PASSED.`);
            } else {
                console.log(`[Diag] Phase 5 SKIPPED: file not found.`);
            }
        } catch (e: any) {
            console.error(`[Diag] Phase 5 FAILED:`, e.message);
        }

        // Check what schemas exist
        const schemas = await pool.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name`);
        console.log(`\n[Diag] Schemas present in ${TEST_DB}:`, schemas.rows.map((r: any) => r.schema_name));

        await pool.end();

        // Cleanup
        await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
        console.log(`[Diag] Cleaned up ${TEST_DB}.`);
    } catch (e) {
        console.error('[Diag] FATAL:', e);
    } finally {
        await adminPool.end();
    }
}

main();
