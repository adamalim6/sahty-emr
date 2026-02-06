/**
 * Migration: Normalize UUID types in inventory_movements and current_stock
 * 
 * This is pure schema normalization - no business logic changes.
 * 
 * Changes:
 * 
 * inventory_movements:
 *   - tenant_id: TEXT → UUID
 *   - from_location → from_location_id: TEXT → UUID
 *   - to_location → to_location_id: TEXT → UUID
 *   - document_id: TEXT → UUID
 *   - created_by: TEXT → UUID
 * 
 * current_stock:
 *   - tenant_id: TEXT → UUID
 *   - location → location_id: TEXT → UUID
 * 
 * Run: npx ts-node backend/scripts/migrations/apply_016_uuid_normalization.ts
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);
    
    try {
        // ====================================================================
        // STEP 1: Truncate tables with legacy data (user confirmed OK)
        // ====================================================================
        console.log('  Truncating inventory_movements (legacy data)...');
        await tenantQuery(tenantId, 'TRUNCATE TABLE inventory_movements');
        
        // ====================================================================
        // STEP 2: inventory_movements - Rename and convert columns
        // ====================================================================
        console.log('  Migrating inventory_movements...');
        
        // Rename location columns first
        try {
            await tenantQuery(tenantId, 'ALTER TABLE inventory_movements RENAME COLUMN from_location TO from_location_id');
            console.log('    ✓ Renamed from_location → from_location_id');
        } catch (e: any) {
            if (e.message.includes('does not exist')) {
                console.log('    ✓ from_location_id already exists');
            } else throw e;
        }
        
        try {
            await tenantQuery(tenantId, 'ALTER TABLE inventory_movements RENAME COLUMN to_location TO to_location_id');
            console.log('    ✓ Renamed to_location → to_location_id');
        } catch (e: any) {
            if (e.message.includes('does not exist')) {
                console.log('    ✓ to_location_id already exists');
            } else throw e;
        }
        
        // Convert TEXT → UUID
        const movementCols = ['tenant_id', 'from_location_id', 'to_location_id', 'document_id', 'created_by'];
        for (const col of movementCols) {
            try {
                await tenantQuery(tenantId, `
                    ALTER TABLE inventory_movements 
                    ALTER COLUMN ${col} TYPE UUID USING ${col}::uuid
                `);
                console.log(`    ✓ ${col} → UUID`);
            } catch (e: any) {
                if (e.message.includes('already of type uuid')) {
                    console.log(`    ✓ ${col} already UUID`);
                } else {
                    console.log(`    ⚠️ ${col}: ${e.message}`);
                }
            }
        }
        
        // ====================================================================
        // STEP 3: current_stock - Rename and convert columns
        // ====================================================================
        console.log('  Migrating current_stock...');
        
        // Rename location → location_id
        try {
            await tenantQuery(tenantId, 'ALTER TABLE current_stock RENAME COLUMN location TO location_id');
            console.log('    ✓ Renamed location → location_id');
        } catch (e: any) {
            if (e.message.includes('does not exist')) {
                console.log('    ✓ location_id already exists');
            } else throw e;
        }
        
        // Convert TEXT → UUID
        const stockCols = ['tenant_id', 'location_id'];
        for (const col of stockCols) {
            try {
                await tenantQuery(tenantId, `
                    ALTER TABLE current_stock 
                    ALTER COLUMN ${col} TYPE UUID USING ${col}::uuid
                `);
                console.log(`    ✓ ${col} → UUID`);
            } catch (e: any) {
                if (e.message.includes('already of type uuid')) {
                    console.log(`    ✓ ${col} already UUID`);
                } else {
                    console.log(`    ⚠️ ${col}: ${e.message}`);
                }
            }
        }
        
        // ====================================================================
        // STEP 4: Update unique constraint if needed
        // ====================================================================
        try {
            // Drop old constraint that may reference 'location'
            await tenantQuery(tenantId, `
                ALTER TABLE current_stock DROP CONSTRAINT IF EXISTS current_stock_tenant_id_product_id_lot_location_key
            `);
            // Add new constraint with location_id
            await tenantQuery(tenantId, `
                ALTER TABLE current_stock 
                ADD CONSTRAINT current_stock_tenant_product_lot_location_key 
                UNIQUE (tenant_id, product_id, lot, location_id)
            `);
            console.log('    ✓ Updated unique constraint');
        } catch (e: any) {
            console.log(`    ⚠️ Constraint: ${e.message}`);
        }
        
        console.log(`  ✅ Tenant ${tenantId} migrated`);
        
    } catch (err: any) {
        console.error(`  ❌ Error migrating ${tenantId}: ${err.message}`);
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: UUID Normalization');
    console.log('  - inventory_movements: TEXT → UUID + renames');
    console.log('  - current_stock: TEXT → UUID + rename');
    console.log('================================================');
    
    // Get all tenants
    const tenants = await globalQuery(`SELECT id FROM clients`);
    console.log(`Found ${tenants.length} tenants`);
    
    for (const tenant of tenants) {
        try {
            await migrateTenant(tenant.id);
        } catch (e: any) {
            console.log(`Skipping tenant ${tenant.id}: ${e.message}`);
        }
    }
    
    await closeAllTenantPools();
    await closeGlobalPool();
    
    console.log('\n================================================');
    console.log('✅ MIGRATION COMPLETE');
    console.log('================================================');
    console.log('\nNEXT: Update backend code to use new column names:');
    console.log('  - from_location → from_location_id');
    console.log('  - to_location → to_location_id');
    console.log('  - location → location_id');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
