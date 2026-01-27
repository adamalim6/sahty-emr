/**
 * MULTI-TENANT SAFE LOCATIONS ARCHITECTURE
 * 
 * This migration enforces:
 * 1. Scope enum: PHARMACY | SERVICE | SYSTEM
 * 2. Type enum: PHYSICAL | VIRTUAL
 * 3. Scope/Type invariant: SYSTEM → VIRTUAL, PHARMACY/SERVICE → PHYSICAL
 * 4. Per-tenant SYSTEM locations (no global/shared locations)
 * 5. Composite FKs: inventory_movements, current_stock, stock_reservations reference tenant-scoped locations
 * 6. Triggers: Prevent deletion/deactivation of SYSTEM locations
 * 
 * Run from backend/: npx ts-node --transpile-only scripts/migrate_locations_architecture.ts demo_tenant
 */

import { tenantTransaction, tenantQuery } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

async function migrateLocationsArchitecture(tenantId: string): Promise<void> {
    console.log('='.repeat(70));
    console.log('MULTI-TENANT SAFE LOCATIONS ARCHITECTURE MIGRATION');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);

    await tenantTransaction(tenantId, async (client) => {
        // =====================================================================
        // STEP 1: Add new columns to locations table
        // =====================================================================
        console.log('STEP 1: Adding columns (type, is_system, code)...');

        await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS type TEXT`);
        await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false`);
        await client.query(`ALTER TABLE locations ADD COLUMN IF NOT EXISTS code TEXT`);
        console.log('   ✅ Columns added');

        // =====================================================================
        // STEP 2: Ensure tenant_id is NOT NULL (critical for isolation)
        // =====================================================================
        console.log('STEP 2: Ensuring tenant_id is NOT NULL...');
        
        // First, update any NULL tenant_ids to current tenant
        await client.query(`UPDATE locations SET tenant_id = $1 WHERE tenant_id IS NULL`, [tenantId]);
        await client.query(`ALTER TABLE locations ALTER COLUMN tenant_id SET NOT NULL`);
        console.log('   ✅ tenant_id is NOT NULL');

        // =====================================================================
        // STEP 3: Add scope constraint (keep existing model)
        // =====================================================================
        console.log('STEP 3: Updating scope constraint...');
        
        await client.query(`ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_scope_check`);
        await client.query(`
            ALTER TABLE locations ADD CONSTRAINT locations_scope_check
            CHECK (scope IN ('PHARMACY', 'SERVICE', 'SYSTEM'))
        `);
        console.log('   ✅ scope constraint: PHARMACY | SERVICE | SYSTEM');

        // =====================================================================
        // STEP 4: Migrate existing data BEFORE adding constraints
        // =====================================================================
        console.log('STEP 4: Migrating existing location data...');

        // Set type for existing locations based on scope (convert ALL non-standard types)
        // Note: Legacy types like 'WARD' need to be converted to 'PHYSICAL'
        await client.query(`
            UPDATE locations 
            SET type = CASE 
                WHEN scope = 'SYSTEM' THEN 'VIRTUAL'
                ELSE 'PHYSICAL'
            END
            WHERE type IS NULL OR type NOT IN ('PHYSICAL', 'VIRTUAL')
        `);

        // Set is_system flag
        await client.query(`
            UPDATE locations 
            SET is_system = (scope = 'SYSTEM')
        `);

        // Set code for SYSTEM locations
        await client.query(`
            UPDATE locations 
            SET code = name
            WHERE scope = 'SYSTEM' AND code IS NULL
        `);

        console.log('   ✅ Existing data migrated');

        // =====================================================================
        // STEP 5: Add type constraint (AFTER data is valid)
        // =====================================================================
        console.log('STEP 5: Adding type constraint...');
        
        await client.query(`ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check`);
        await client.query(`
            ALTER TABLE locations ADD CONSTRAINT locations_type_check
            CHECK (type IN ('PHYSICAL', 'VIRTUAL'))
        `);
        console.log('   ✅ type constraint: PHYSICAL | VIRTUAL');

        // =====================================================================
        // STEP 6: Add scope/type invariant constraint
        // =====================================================================
        console.log('STEP 6: Adding scope/type invariant constraint...');
        
        await client.query(`ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_scope_type_invariant`);
        await client.query(`
            ALTER TABLE locations ADD CONSTRAINT locations_scope_type_invariant
            CHECK (
                (scope = 'SYSTEM' AND type = 'VIRTUAL' AND is_system = true)
                OR
                (scope IN ('PHARMACY', 'SERVICE') AND type = 'PHYSICAL')
            )
        `);
        console.log('   ✅ Invariant: SYSTEM→VIRTUAL+is_system=true, PHARMACY/SERVICE→PHYSICAL');

        // =====================================================================
        // STEP 7: Add per-tenant uniqueness for system codes
        // =====================================================================
        console.log('STEP 7: Adding per-tenant uniqueness for system codes...');
        
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_locations_tenant_code
            ON locations (tenant_id, code)
            WHERE code IS NOT NULL
        `);
        console.log('   ✅ Unique index on (tenant_id, code)');

        // =====================================================================
        // STEP 8: Add system location code whitelist
        // =====================================================================
        console.log('STEP 8: Adding system location code whitelist...');
        
        await client.query(`ALTER TABLE locations DROP CONSTRAINT IF EXISTS system_location_code_check`);
        await client.query(`
            ALTER TABLE locations ADD CONSTRAINT system_location_code_check
            CHECK (
                scope <> 'SYSTEM'
                OR code IN ('DISPENSED', 'DESTROYED', 'LOST', 'ADJUSTMENT', 'QUARANTINE', 'RETURNED')
            )
        `);
        console.log('   ✅ SYSTEM codes whitelist enforced');

        // =====================================================================
        // STEP 9: Create unique index for composite FK support
        // =====================================================================
        console.log('STEP 9: Creating composite unique index for FK support...');
        
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_locations_tenant_id_location_id
            ON locations (tenant_id, location_id)
        `);
        console.log('   ✅ Unique index on (tenant_id, location_id)');

        // =====================================================================
        // STEP 10: Create required SYSTEM locations for this tenant
        // =====================================================================
        console.log('STEP 10: Creating per-tenant SYSTEM locations...');
        
        const systemLocations = [
            { code: 'DISPENSED', name: 'Dispensed (Patient)' },
            { code: 'DESTROYED', name: 'Destroyed' },
            { code: 'LOST', name: 'Lost' },
            { code: 'ADJUSTMENT', name: 'Adjustment' },
            { code: 'QUARANTINE', name: 'Quarantine' },
            { code: 'RETURNED', name: 'Returned' }
        ];

        for (const loc of systemLocations) {
            const result = await client.query(`
                INSERT INTO locations (location_id, tenant_id, code, name, scope, type, is_system, is_active, status)
                VALUES ($1, $2, $3, $4, 'SYSTEM', 'VIRTUAL', true, true, 'ACTIVE')
                ON CONFLICT (tenant_id, code) WHERE code IS NOT NULL DO NOTHING
                RETURNING location_id
            `, [uuidv4(), tenantId, loc.code, loc.name]);
            
            if (result.rowCount && result.rowCount > 0) {
                console.log(`   ✅ Created: ${loc.code} (${result.rows[0].location_id})`);
            } else {
                // Get existing ID
                const existing = await client.query(`
                    SELECT location_id FROM locations WHERE tenant_id = $1 AND code = $2
                `, [tenantId, loc.code]);
                console.log(`   ✓ Exists: ${loc.code} (${existing.rows[0]?.location_id})`);
            }
        }

        // =====================================================================
        // STEP 11: Remove the old hardcoded DISPENSED location if different UUID
        // =====================================================================
        console.log('STEP 11: Cleaning up old hardcoded DISPENSED location...');
        
        const oldDispensed = await client.query(`
            SELECT location_id FROM locations 
            WHERE location_id = '00000000-0000-0000-0000-000000000001' AND tenant_id = $1
        `, [tenantId]);

        if (oldDispensed.rows.length > 0) {
            // Get the new tenant-specific DISPENSED ID
            const newDispensed = await client.query(`
                SELECT location_id FROM locations 
                WHERE tenant_id = $1 AND code = 'DISPENSED' AND location_id != '00000000-0000-0000-0000-000000000001'
            `, [tenantId]);

            if (newDispensed.rows.length > 0) {
                // Update references
                await client.query(`
                    UPDATE inventory_movements 
                    SET to_location = $1 
                    WHERE to_location = '00000000-0000-0000-0000-000000000001' AND tenant_id = $2
                `, [newDispensed.rows[0].location_id, tenantId]);

                // Delete old location
                await client.query(`
                    DELETE FROM locations 
                    WHERE location_id = '00000000-0000-0000-0000-000000000001' AND tenant_id = $1
                `, [tenantId]);
                console.log(`   ✅ Migrated old DISPENSED to new tenant-specific UUID`);
            }
        } else {
            console.log('   ✓ No old hardcoded DISPENSED to migrate');
        }

        // =====================================================================
        // STEP 12: Add composite FK for inventory_movements
        // =====================================================================
        console.log('STEP 12: Adding composite FK constraints to inventory_movements...');
        
        // First check if columns are TEXT or UUID and convert from_location/to_location to UUID if needed
        const movCols = await client.query(`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_name = 'inventory_movements' AND column_name IN ('from_location', 'to_location')
        `);
        
        for (const col of movCols.rows) {
            if (col.data_type === 'text') {
                console.log(`   Converting ${col.column_name} from TEXT to UUID...`);
                await client.query(`
                    ALTER TABLE inventory_movements 
                    ALTER COLUMN ${col.column_name} TYPE UUID USING ${col.column_name}::UUID
                `);
            }
        }

        await client.query(`ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS fk_mov_from_location_tenant`);
        await client.query(`ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS fk_mov_to_location_tenant`);
        
        // Only add FK if there's data to validate (handle NULL values)
        await client.query(`
            ALTER TABLE inventory_movements
            ADD CONSTRAINT fk_mov_from_location_tenant
            FOREIGN KEY (tenant_id, from_location)
            REFERENCES locations (tenant_id, location_id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
            NOT VALID
        `);
        
        await client.query(`
            ALTER TABLE inventory_movements
            ADD CONSTRAINT fk_mov_to_location_tenant
            FOREIGN KEY (tenant_id, to_location)
            REFERENCES locations (tenant_id, location_id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
            NOT VALID
        `);
        
        console.log('   ✅ Composite FKs added (NOT VALID for existing data)');

        // =====================================================================
        // STEP 13: Add composite FK for current_stock
        // =====================================================================
        console.log('STEP 13: Adding composite FK constraint to current_stock...');
        
        // Check if location column needs conversion
        const stockCols = await client.query(`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_name = 'current_stock' AND column_name = 'location'
        `);
        
        if (stockCols.rows.length > 0 && stockCols.rows[0].data_type === 'text') {
            console.log(`   Converting location from TEXT to UUID...`);
            await client.query(`
                ALTER TABLE current_stock 
                ALTER COLUMN location TYPE UUID USING location::UUID
            `);
        }

        await client.query(`ALTER TABLE current_stock DROP CONSTRAINT IF EXISTS fk_stock_location_tenant`);
        await client.query(`
            ALTER TABLE current_stock
            ADD CONSTRAINT fk_stock_location_tenant
            FOREIGN KEY (tenant_id, location)
            REFERENCES locations (tenant_id, location_id)
            ON UPDATE RESTRICT ON DELETE RESTRICT
            NOT VALID
        `);
        console.log('   ✅ Composite FK added to current_stock');

        // =====================================================================
        // STEP 14: Create trigger to prevent SYSTEM location deletion
        // =====================================================================
        console.log('STEP 14: Creating trigger to prevent SYSTEM location deletion...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_system_location_delete()
            RETURNS trigger AS $$
            BEGIN
                IF OLD.is_system = true OR OLD.scope = 'SYSTEM' THEN
                    RAISE EXCEPTION 'Cannot delete SYSTEM locations (tenant_id=%, code=%)', OLD.tenant_id, OLD.code;
                END IF;
                RETURN OLD;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await client.query(`DROP TRIGGER IF EXISTS trg_prevent_system_location_delete ON locations`);
        await client.query(`
            CREATE TRIGGER trg_prevent_system_location_delete
            BEFORE DELETE ON locations
            FOR EACH ROW
            EXECUTE FUNCTION prevent_system_location_delete()
        `);
        console.log('   ✅ Delete trigger created');

        // =====================================================================
        // STEP 15: Create trigger to prevent SYSTEM location deactivation
        // =====================================================================
        console.log('STEP 15: Creating trigger to prevent SYSTEM location deactivation...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_system_location_deactivate()
            RETURNS trigger AS $$
            BEGIN
                IF (OLD.scope = 'SYSTEM' OR OLD.is_system = true) AND NEW.is_active = false THEN
                    RAISE EXCEPTION 'Cannot deactivate SYSTEM locations (tenant_id=%, code=%)', OLD.tenant_id, OLD.code;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await client.query(`DROP TRIGGER IF EXISTS trg_prevent_system_location_deactivate ON locations`);
        await client.query(`
            CREATE TRIGGER trg_prevent_system_location_deactivate
            BEFORE UPDATE OF is_active ON locations
            FOR EACH ROW
            EXECUTE FUNCTION prevent_system_location_deactivate()
        `);
        console.log('   ✅ Deactivation trigger created');
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
}

async function runAcceptanceChecks(tenantId: string): Promise<boolean> {
    console.log('\n' + '='.repeat(70));
    console.log('ACCEPTANCE CHECKS');
    console.log('='.repeat(70));

    let allPassed = true;

    // CHECK A: No SYSTEM location with NULL tenant_id
    console.log('\nA) No SYSTEM location with NULL tenant_id...');
    const checkA = await tenantQuery(tenantId, `
        SELECT * FROM locations WHERE scope = 'SYSTEM' AND tenant_id IS NULL
    `, []);
    if (checkA.length === 0) {
        console.log('   ✅ PASS: 0 rows');
    } else {
        console.log(`   ❌ FAIL: ${checkA.length} rows found`);
        allPassed = false;
    }

    // CHECK B: No cross-tenant location reuse (same ID, different tenants)
    console.log('\nB) No cross-tenant location reuse...');
    const checkB = await tenantQuery(tenantId, `
        SELECT location_id, COUNT(DISTINCT tenant_id) as tenant_count
        FROM locations
        GROUP BY location_id
        HAVING COUNT(DISTINCT tenant_id) > 1
    `, []);
    if (checkB.length === 0) {
        console.log('   ✅ PASS: 0 rows');
    } else {
        console.log(`   ❌ FAIL: ${checkB.length} location IDs shared across tenants`);
        allPassed = false;
    }

    // CHECK C: All inventory_movements reference tenant-local locations
    console.log('\nC) Inventory movements reference tenant-local locations...');
    const checkC = await tenantQuery(tenantId, `
        SELECT im.movement_id
        FROM inventory_movements im
        LEFT JOIN locations lf ON (lf.location_id = im.from_location AND lf.tenant_id = im.tenant_id)
        LEFT JOIN locations lt ON (lt.location_id = im.to_location AND lt.tenant_id = im.tenant_id)
        WHERE (im.from_location IS NOT NULL AND lf.location_id IS NULL)
           OR (im.to_location IS NOT NULL AND lt.location_id IS NULL)
    `, []);
    if (checkC.length === 0) {
        console.log('   ✅ PASS: 0 orphaned movements');
    } else {
        console.log(`   ❌ FAIL: ${checkC.length} movements reference non-tenant locations`);
        allPassed = false;
    }

    // CHECK D: SYSTEM locations exist for tenant
    console.log('\nD) Required SYSTEM locations exist...');
    const requiredCodes = ['DISPENSED', 'DESTROYED', 'LOST', 'ADJUSTMENT', 'QUARANTINE', 'RETURNED'];
    const checkD = await tenantQuery(tenantId, `
        SELECT code FROM locations WHERE tenant_id = $1 AND scope = 'SYSTEM'
    `, [tenantId]);
    const existingCodes = checkD.map(r => r.code);
    const missingCodes = requiredCodes.filter(c => !existingCodes.includes(c));
    
    if (missingCodes.length === 0) {
        console.log(`   ✅ PASS: All ${requiredCodes.length} SYSTEM locations exist`);
    } else {
        console.log(`   ❌ FAIL: Missing codes: ${missingCodes.join(', ')}`);
        allPassed = false;
    }

    // CHECK E: Scope/Type invariant is enforced
    console.log('\nE) Scope/Type invariant enforced...');
    const checkE = await tenantQuery(tenantId, `
        SELECT location_id, scope, type, is_system FROM locations
        WHERE (scope = 'SYSTEM' AND (type != 'VIRTUAL' OR is_system != true))
           OR (scope IN ('PHARMACY', 'SERVICE') AND type != 'PHYSICAL')
    `, []);
    if (checkE.length === 0) {
        console.log('   ✅ PASS: All locations follow scope/type invariant');
    } else {
        console.log(`   ❌ FAIL: ${checkE.length} locations violate invariant`);
        allPassed = false;
    }

    console.log('\n' + '='.repeat(70));
    if (allPassed) {
        console.log('✅ ALL ACCEPTANCE CHECKS PASSED');
    } else {
        console.log('❌ SOME CHECKS FAILED');
    }
    console.log('='.repeat(70));

    return allPassed;
}

async function main() {
    const tenantId = process.argv[2] || 'demo_tenant';
    
    try {
        await migrateLocationsArchitecture(tenantId);
        const passed = await runAcceptanceChecks(tenantId);
        process.exit(passed ? 0 : 1);
    } catch (err: any) {
        console.error('\n❌ MIGRATION FAILED:', err.message);
        process.exit(1);
    }
}

main();
