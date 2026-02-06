/**
 * Migration 022: Normalize Supplier IDs and Created By (Purchase Orders)
 * 
 * Objectives:
 * 1. product_suppliers.supplier_id → UUID
 * 2. purchase_orders.supplier_id → UUID
 * 3. purchase_orders.created_by → UUID (Map usernames to user IDs)
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);

    try {
        // 1. purchase_orders.created_by: Map usernames to UUIDs
        console.log('  Mapping purchase_orders.created_by usernames to UUIDs...');
        
        // Update where created_by matches a username and doesn't look like a UUID
        await tenantQuery(tenantId, `
            UPDATE purchase_orders po
            SET created_by = u.id::text
            FROM users u
            WHERE po.created_by = u.username 
              AND po.created_by NOT LIKE '%-%'
              AND length(po.created_by) < 30
        `);
        
        // Nullify any remaining non-UUID values (garbage or deleted users)
        await tenantQuery(tenantId, `
            UPDATE purchase_orders
            SET created_by = NULL
            WHERE created_by NOT LIKE '%-%' OR length(created_by) != 36
        `);
        
        console.log('    ✓ Mapped created_by usernames to UUIDs (or NULL)');

        // 2. Convert Columns to UUID
        const conversions = [
            { table: 'product_suppliers', col: 'supplier_id' },
            { table: 'purchase_orders', col: 'supplier_id' },
            { table: 'purchase_orders', col: 'created_by' }
        ];

        for (const item of conversions) {
            try {
                await tenantQuery(tenantId, `
                    ALTER TABLE "${item.table}" 
                    ALTER COLUMN ${item.col} TYPE UUID USING ${item.col}::uuid
                `);
                console.log(`    ✓ ${item.table}.${item.col} → UUID`);
            } catch (e: any) {
                if (e.message.includes('already of type uuid')) {
                    console.log(`    ✓ ${item.table}.${item.col} already UUID`);
                } else {
                    console.error(`    ❌ Error converting ${item.table}.${item.col}: ${e.message}`);
                }
            }
        }

    } catch (err: any) {
        console.error(`  ❌ Error migrating ${tenantId}: ${err.message}`);
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: Normalize Supplier/Creator UUIDs (022)');
    console.log('================================================');
    
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
    
    console.log('\n✅ MIGRATION 022 COMPLETE');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
