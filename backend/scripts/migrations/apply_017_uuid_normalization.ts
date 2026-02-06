/**
 * Migration: Normalize UUID types in inventory_movements and current_stock
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
 * Run: npx ts-node backend/scripts/migrations/apply_017_uuid_normalization.ts
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);
    
    try {
        // ====================================================================
        // STEP 1: Truncate tables with legacy data
        // ====================================================================
        console.log('  Truncating inventory_movements (legacy data)...');
        await tenantQuery(tenantId, 'TRUNCATE TABLE inventory_movements');
        
        // ====================================================================
        // STEP 2: inventory_movements - Rename and convert columns
        // ====================================================================
        console.log('  Migrating inventory_movements...');
        
        // Rename form_location -> from_location_id
        try {
            await tenantQuery(tenantId, 'ALTER TABLE inventory_movements RENAME COLUMN from_location TO from_location_id');
            console.log('    ✓ Renamed from_location → from_location_id');
        } catch (e: any) {
            if (e.message.includes('does not exist')) {
                // Check if target exists
                console.log('    (from_location might already be renamed)');
            } else throw e;
        }
        
        // Rename to_location -> to_location_id
        try {
            await tenantQuery(tenantId, 'ALTER TABLE inventory_movements RENAME COLUMN to_location TO to_location_id');
            console.log('    ✓ Renamed to_location → to_location_id');
        } catch (e: any) {
             if (e.message.includes('does not exist')) {
                console.log('    (to_location might already be renamed)');
            } else throw e;
        }
        
        // Convert TEXT → UUID
        // Note: we use the NEW names for locations
        const colsToUuid = [
            { col: 'tenant_id', newName: 'tenant_id' },
            { col: 'from_location_id', newName: 'from_location_id' },
            { col: 'to_location_id', newName: 'to_location_id' },
            { col: 'document_id', newName: 'document_id' },
            { col: 'created_by', newName: 'created_by' }
        ];

        for (const item of colsToUuid) {
            try {
                await tenantQuery(tenantId, `
                    ALTER TABLE inventory_movements 
                    ALTER COLUMN ${item.col} TYPE UUID USING ${item.col}::uuid
                `);
                console.log(`    ✓ ${item.col} → UUID`);
            } catch (e: any) {
                if (e.message.includes('already of type uuid')) {
                    console.log(`    ✓ ${item.col} already UUID`);
                } else {
                    console.log(`    ⚠️ ${item.col}: ${e.message}`);
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
                console.log('    (location might already be renamed)');
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
        // STEP 4: Update unique constraint
        // ====================================================================
        try {
            // Drop old constraint
            await tenantQuery(tenantId, `
                ALTER TABLE current_stock DROP CONSTRAINT IF EXISTS current_stock_tenant_id_product_id_lot_location_key
            `);
            // Add new constraint with location_id
            await tenantQuery(tenantId, `
                ALTER TABLE current_stock 
                DROP CONSTRAINT IF EXISTS current_stock_tenant_product_lot_location_key
            `); // Safety drop first

            await tenantQuery(tenantId, `
                ALTER TABLE current_stock 
                ADD CONSTRAINT current_stock_tenant_product_lot_location_key 
                UNIQUE (tenant_id, product_id, lot, location_id)
            `);
            console.log('    ✓ Updated unique constraint');
        } catch (e: any) {
            console.log(`    ⚠️ Constraint error: ${e.message}`);
        }
        
        console.log(`  ✅ Tenant ${tenantId} migrated`);
        
    } catch (err: any) {
        console.error(`  ❌ Error migrating ${tenantId}: ${err.message}`);
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: UUID Normalization (Apply 017)');
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
    
    console.log('\n✅ MIGRATION COMPLETE');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
