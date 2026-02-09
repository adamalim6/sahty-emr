
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { getTenantDbName } from '../db/tenantPg';

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
        console.log(`[TenantProvisioning] Applying schema to ${dbName}...`);
        
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
            // PHASE 1a: Base Schema (root-level migrations/pg/tenant/)
            // Creates ALL core tables, adds tier2 columns, and indexes
            // ================================================================
            const rootSchemaDir = path.join(__dirname, '../../migrations/pg/tenant');
            const baseFiles = [
                '000_init.sql',              // Core tables (inventory, stock, settings, EMR, returns)
                '001_tier2_additions.sql',    // Reservation engine columns
                '010_indexes.sql',           // Performance indexes
            ];

            for (const file of baseFiles) {
                const filePath = path.join(rootSchemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running ${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.error(`[TenantProvisioning] CRITICAL: Schema file not found: ${filePath}`);
                    throw new Error(`Required schema file not found: ${file}`);
                }
            }
            
            console.log(`[TenantProvisioning] Phase 1a (Base Schema) applied successfully.`);

            // Create essential system locations BEFORE incremental migrations
            // Migration 021 reads tenant_id from existing locations — they must exist.
            // NOTE: At this point, locations.tenant_id is still TEXT (not UUID — that's migration 025)
            console.log(`[TenantProvisioning] Creating system locations...`);
            
            // RETURN_QUARANTINE
            await pool.query(`
                INSERT INTO locations (
                    location_id, tenant_id, name, type, scope, 
                    location_class, valuation_policy, service_id, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, 'RETURN_QUARANTINE', 'VIRTUAL', 'SYSTEM',
                    'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()
                )
                ON CONFLICT DO NOTHING
            `, [tenantId]);
            
            // WASTE Location (Mandatory System Location)
            await pool.query(`
                INSERT INTO locations (
                    location_id, tenant_id, name, type, scope, 
                    location_class, valuation_policy, service_id, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, 'WASTE', 'VIRTUAL', 'SYSTEM',
                    'COMMERCIAL', 'NON_VALUABLE', NULL, 'ACTIVE', NOW()
                )
                ON CONFLICT DO NOTHING
            `, [tenantId]);

            // ================================================================
            // PHASE 1b: Incremental Migrations (evolve base schema to current state)
            // These add columns, normalize constraints, split tables, etc.
            // ================================================================
            const incrementalFiles = [
                '011_add_demand_ref.sql',
                '011_add_demand_processing_cols.sql',
                '012_normalize_document_type.sql',
                '013_drop_client_request_id.sql',
                '014_split_reservations.sql',
                '015_add_return_lineage.sql',
                '016_add_return_reference.sql',
                '017_add_reception_reference.sql',
                '018_add_return_reception_type.sql',
                '019_add_partially_received_status.sql',
                '020_return_decisions_update.sql',
                '021_return_decisions_locations.sql',
                '022_patient_tenant_rework.sql',  // patients_tenant, contacts, addresses, insurances
                '023_patient_network.sql',        // persons, relationships, emergency contacts, guardians
                '024_universal_audit.sql',        // audit_log + triggers
                '025_standardize_tenant_ids.sql', // TEXT -> UUID tenant_id conversions
            ];

            for (const file of incrementalFiles) {
                const filePath = path.join(rootSchemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running ${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.error(`[TenantProvisioning] CRITICAL: Schema file not found: ${filePath}`);
                    throw new Error(`Required schema file not found: ${file}`);
                }
            }
            
            console.log(`[TenantProvisioning] Phase 1b (Incremental Migrations) applied successfully.`);

            // ================================================================
            // PHASE 2: Identity Schema (backend/migrations/pg/tenant/)
            // These create the identity schema and refactor patients_tenant
            // ================================================================
            const identitySchemaDir = path.join(__dirname, '../migrations/pg/tenant');
            const identityFiles = [
                '001_identity_schema_tenant.sql',   // identity schema + master_patients
                '002_refactor_patient_tenant.sql',   // Add master_patient_id to patients_tenant
                '003_drop_global_patient_id.sql',    // Remove legacy global_patient_id
            ];

            for (const file of identityFiles) {
                const filePath = path.join(identitySchemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running identity/${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.error(`[TenantProvisioning] CRITICAL: Identity file not found: ${filePath}`);
                    throw new Error(`Required identity file not found: ${file}`);
                }
            }

            console.log(`[TenantProvisioning] Phase 2 (Identity Schema) applied successfully.`);

            // ================================================================
            // PHASE 3: Reference Data Sync (Global -> Tenant)
            // ================================================================
            const { syncTenantReference } = require('../scripts/referenceSync');
            await syncTenantReference(pool, tenantId);
            console.log(`[TenantProvisioning] Phase 3 (Reference Sync) complete.`);
            
            // ================================================================
            // PHASE 4: Post-Sync Migrations (require reference tables to exist)
            // ================================================================
            const postSyncFiles = [
                '004_fix_tenant_document_types.sql', // FK update to reference.identity_document_types
            ];

            for (const file of postSyncFiles) {
                const filePath = path.join(identitySchemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running post-sync/${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.warn(`[TenantProvisioning] Post-sync file not found: ${filePath}`);
                }
            }

            // ================================================================
            // PHASE 5: Post-Identity Structural Migrations
            // These require master_patient_id (from Phase 2) to exist
            // ================================================================
            const postIdentityFiles = [
                '026_local_chart_merge.sql',      // Merge pointers + events (needs master_patient_id)
                '027_remove_public_roles.sql',     // Drop legacy public.roles (now using reference.global_roles)
            ];

            for (const file of postIdentityFiles) {
                const filePath = path.join(rootSchemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running post-identity/${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.error(`[TenantProvisioning] CRITICAL: Post-identity file not found: ${filePath}`);
                    throw new Error(`Required post-identity file not found: ${file}`);
                }
            }

            console.log(`[TenantProvisioning] Schema fully applied to ${dbName}.`);

        } finally {
            await pool.end();
        }
    }
}

export const tenantProvisioningService = TenantProvisioningService.getInstance();
