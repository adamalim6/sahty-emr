
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { getTenantDbName } from '../db/tenantPg';
import { identityQuery } from '../db/identityPg';

export class TenantProvisioningService {
    private static instance: TenantProvisioningService;
    
    // Use SAHTY_EMR (default) or SAHTY_GLOBAL to connect for admin tasks
    // We need a pool that is NOT connected to the target tenant DB (which doesn't exist yet)
    private adminPool: Pool;

    private constructor() {
        this.adminPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: process.env.PG_DB || 'sahty_emr' // Default DB to connect to
        });
    }

    public static getInstance(): TenantProvisioningService {
        if (!TenantProvisioningService.instance) {
            TenantProvisioningService.instance = new TenantProvisioningService();
        }
        return TenantProvisioningService.instance;
    }


    public async createTenantDatabase(tenantId: string): Promise<void> {
        // SAFETY CHECK: Ensure Identity DB is reachable
        try {
            const { getIdentityPool } = require('../db/identityPg');
            await getIdentityPool().query('SELECT 1');
        } catch (e: any) {
            console.error(`[TenantProvisioning] CRITICAL: sahty_identity DB not reachable: ${e.message}`);
            throw new Error(`Cannot provision tenant: Identity DB unreachable.`);
        }

        const dbName = getTenantDbName(tenantId);
        console.log(`[TenantProvisioning] Checking database ${dbName}...`);
        
        try {
            // Check if DB exists
            const checkRes = await this.adminPool.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbName]
            );

            if (checkRes.rows.length === 0) {
                console.log(`[TenantProvisioning] Creating database ${dbName}...`);
                // CREATE DATABASE cannot run in a transaction block
                await this.adminPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`[TenantProvisioning] Database ${dbName} created.`);
                
                // Now apply schema
                await this.applySchema(tenantId, dbName);
            } else {
                console.log(`[TenantProvisioning] Database ${dbName} already exists.`);
            }
        } catch (error: any) {
            console.error(`[TenantProvisioning] Failed to create database ${dbName}:`, error);
            throw error;
        }
    }

    private async applySchema(tenantId: string, dbName: string): Promise<void> {
        console.log(`[TenantProvisioning] Applying baseline schema to ${dbName}...`);
        
        // Connect specifically to the new DB
        const pool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: dbName
        });

        try {
            // ================================================================
            // PHASE 1: Apply Clean Baseline Schema
            // Single SQL file creates ALL schemas/tables/indexes/triggers
            // ================================================================
            const baselineFile = path.join(__dirname, '../migrations/pg/tenant/baseline_tenant_schema.sql');
            if (!fs.existsSync(baselineFile)) {
                throw new Error(`CRITICAL: baseline_tenant_schema.sql not found at ${baselineFile}`);
            }
            const baselineSql = fs.readFileSync(baselineFile, 'utf-8');
            await pool.query(baselineSql);
            console.log(`[TenantProvisioning] Phase 1 (Baseline Schema) applied — all 5 schemas created.`);

            // ================================================================
            // PHASE 1.1: Apply Identity Refactor (Feb 2026)
            // The baseline contains the OLD identity schema (persons, etc.)
            // We must apply the destructive refactor to align with the new architecture.
            // ================================================================
            const identityMigrations = [
                '040_refactor_identity_destructive.sql',
                '041_create_new_identity_tables.sql',
                '042_setup_sync_schema.sql',
                '043_fix_audit_trigger.sql'
            ];

            for (const migFile of identityMigrations) {
                const migPath = path.join(__dirname, `../migrations/pg/tenant/${migFile}`);
                if (fs.existsSync(migPath)) {
                    console.log(`[TenantProvisioning] Applying ${migFile}...`);
                    const sql = fs.readFileSync(migPath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.warn(`[TenantProvisioning] Warning: ${migFile} not found.`);
                }
            }
            console.log(`[TenantProvisioning] Phase 1.1 (Identity Refactor) applied.`);

            // ================================================================
            // PHASE 2: Create System Locations
            // ================================================================
            console.log(`[TenantProvisioning] Creating system locations...`);
            
            await pool.query(`
                INSERT INTO locations (
                    location_id, tenant_id, name, type, scope, 
                    location_class, valuation_policy, service_id, status, created_at
                ) VALUES 
                (gen_random_uuid(), $1, 'RETURN_QUARANTINE', 'VIRTUAL', 'SYSTEM',
                 'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()),
                (gen_random_uuid(), $1, 'WASTE', 'VIRTUAL', 'SYSTEM',
                 'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()),
                (gen_random_uuid(), $1, 'QUARANTINE_DELIVERY', 'VIRTUAL', 'SYSTEM',
                 'COMMERCIAL', 'VALUABLE', NULL, 'ACTIVE', NOW())
                ON CONFLICT DO NOTHING
            `, [tenantId]);
            console.log(`[TenantProvisioning] Phase 2 (System Locations) created.`);

            // ================================================================
            // PHASE 3: Reference Data Sync (Global -> Tenant)
            // Populates reference.global_products, global_roles, etc.
            // ================================================================
            const { syncTenantReference } = require('../scripts/referenceSync');
            await syncTenantReference(pool, tenantId);
            console.log(`[TenantProvisioning] Phase 3 (Reference Sync) complete.`);

            // ================================================================
            // PHASE 3.1: Seed System Smart Phrases
            // ================================================================
            try {
                console.log(`[TenantProvisioning] Phase 3.1: Seeding System Smart Phrases...`);
                const { getGlobalPool } = require('../db/globalPg');
                const globalPool = getGlobalPool();
                const globalRes = await globalPool.query(`
                    SELECT id, trigger, trigger_search, label, description, body_html, is_active 
                    FROM smart_phrases 
                    WHERE scope = 'system' AND is_active = TRUE
                `);
                
                if (globalRes.rows.length > 0) {
                    for (const row of globalRes.rows) {
                        await pool.query(`
                            INSERT INTO smart_phrases (id, trigger, trigger_search, label, description, body_html, scope, tenant_id, user_id, is_active, created_at, updated_at)
                            VALUES ($1, $2, $3, $4, $5, $6, 'system', $7, NULL, $8, NOW(), NOW())
                            ON CONFLICT DO NOTHING
                        `, [row.id, row.trigger, row.trigger_search, row.label, row.description, row.body_html, tenantId, row.is_active]);
                    }
                    console.log(`[TenantProvisioning] Phase 3.1 (Smart Phrases) injected ${globalRes.rows.length} rows.`);
                }
            } catch (err: any) {
                console.warn(`[TenantProvisioning] Failed to seed smart phrases: ${err.message}`);
                throw err;
            }

            // ================================================================
            // PHASE 3.2: Structural Validation
            // ================================================================
            try {
                console.log(`[TenantProvisioning] Phase 3.2: Structural Validation against ced91ced...`);
                const refDbName = 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895';
                
                // Get columns from reference DB
                const refPool = new Pool({
                    host: process.env.PG_HOST || 'localhost',
                    port: parseInt(process.env.PG_PORT || '5432'),
                    user: process.env.PG_USER || 'sahty',
                    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
                    database: refDbName
                });
                
                const refColsRes = await refPool.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'smart_phrases'
                    ORDER BY column_name
                `);
                await refPool.end();
                
                const currColsRes = await pool.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'smart_phrases'
                    ORDER BY column_name
                `);
                
                const refCols = JSON.stringify(refColsRes.rows);
                const currCols = JSON.stringify(currColsRes.rows);
                
                if (refCols !== currCols || refColsRes.rows.length === 0) {
                    throw new Error(`CRITICAL: Smart phrases table structure does not match reference DB! Validation Failed.`);
                }
                console.log(`[TenantProvisioning] Phase 3.2 Structural Validation Passed.`);
            } catch (err: any) {
                console.error(`[TenantProvisioning] Validation Failed: ${err.message}`);
                throw err;
            }


            // ================================================================
            // PHASE 4: Register Identity Sync Cursor
            // New tenants start at current max outbox_seq
            // ================================================================
            try {
                const seqRes = await identityQuery(
                    `SELECT COALESCE(MAX(outbox_seq), 0) as max_seq FROM identity_sync.outbox_events`
                );
                const maxSeq = parseInt(seqRes[0]?.max_seq || '0', 10);

                await identityQuery(`
                    INSERT INTO identity_sync.tenant_cursors (tenant_id, last_outbox_seq, updated_at)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (tenant_id) DO UPDATE SET last_outbox_seq = $2, updated_at = NOW()
                `, [tenantId, maxSeq]);

                console.log(`[TenantProvisioning] Phase 4 (Identity Sync Cursor) registered at seq ${maxSeq}.`);
            } catch (err: any) {
                console.warn(`[TenantProvisioning] Could not register sync cursor: ${err.message}`);
            }

            // ================================================================
            // PHASE 5: Apply Auth Sync Schema
            // Creates auth_sync schema + outbox/inbox/triggers for ALL tenants.
            // Sync worker only processes GROUP_MANAGED tenants, but schema
            // is always present for seamless future conversion.
            // ================================================================
            try {
                const authSyncFile = path.join(__dirname, '../migrations/pg/tenant/setup_auth_sync_tenant.sql');
                if (fs.existsSync(authSyncFile)) {
                    const authSyncSql = fs.readFileSync(authSyncFile, 'utf-8');
                    await pool.query(authSyncSql);
                    console.log(`[TenantProvisioning] Phase 5 (Auth Sync Schema) applied.`);
                } else {
                    console.warn(`[TenantProvisioning] Auth sync SQL not found at ${authSyncFile} — skipping.`);
                }
            } catch (err: any) {
                console.warn(`[TenantProvisioning] Could not apply auth sync schema: ${err.message}`);
            }

            console.log(`[TenantProvisioning] Schema fully applied to ${dbName}.`);

        } finally {
            await pool.end();
        }
    }
}

export const tenantProvisioningService = TenantProvisioningService.getInstance();
