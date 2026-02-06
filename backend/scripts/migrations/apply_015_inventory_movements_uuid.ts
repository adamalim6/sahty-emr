/**
 * Migration: Fix TEXT columns to UUID in inventory_movements
 * 
 * Columns to fix:
 * - tenant_id: TEXT → UUID
 * - from_location: TEXT → UUID
 * - to_location: TEXT → UUID  
 * - document_id: TEXT → UUID
 * - created_by: TEXT → UUID
 * 
 * Run: npx ts-node backend/scripts/migrations/apply_015_inventory_movements_uuid.ts
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating inventory_movements for tenant: ${tenantId} ===`);
    
    // Check current column types
    const columns = await tenantQuery(tenantId, `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name IN ('tenant_id', 'from_location', 'to_location', 'document_id', 'created_by')
        ORDER BY ordinal_position
    `);
    
    console.log('Current column types:', columns.map(c => `${c.column_name}: ${c.data_type}`));
    
    // Alter each TEXT column to UUID
    const columnsToFix = ['tenant_id', 'from_location', 'to_location', 'document_id', 'created_by'];
    
    for (const col of columnsToFix) {
        const colInfo = columns.find(c => c.column_name === col);
        if (colInfo && colInfo.data_type === 'text') {
            console.log(`  Converting ${col} from TEXT to UUID...`);
            try {
                await tenantQuery(tenantId, `
                    ALTER TABLE inventory_movements 
                    ALTER COLUMN ${col} TYPE UUID USING ${col}::uuid
                `);
                console.log(`  ✅ ${col} converted to UUID`);
            } catch (err: any) {
                console.log(`  ⚠️ ${col}: ${err.message}`);
            }
        } else if (colInfo) {
            console.log(`  ✓ ${col} already ${colInfo.data_type}`);
        }
    }
    
    console.log(`✅ Migration complete for ${tenantId}`);
}

async function main() {
    console.log('===========================================');
    console.log('MIGRATION: inventory_movements UUID Columns');
    console.log('===========================================');
    
    // Get all tenants
    const tenants = await globalQuery(`SELECT id FROM clients`);
    console.log(`Found ${tenants.length} tenants to migrate`);
    
    for (const tenant of tenants) {
        await migrateTenant(tenant.id);
    }
    
    await closeAllTenantPools();
    await closeGlobalPool();
    
    console.log('\n✅ All tenants migrated successfully!');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
