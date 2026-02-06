/**
 * Migration: Normalize tenant_id to UUID in all remaining tables
 * 
 * Affects:
 * - delivery_notes, delivery_note_lines, delivery_note_layers
 * - po_items, purchase_orders
 * - stock_demand_lines
 * - stock_transfers, stock_transfer_lines
 * - services, locations, suppliers
 * - admissions, prescriptions, appointments
 * - medication_dispense_events
 * - actes, product_configs, product_suppliers, product_price_versions
 * - stock_returns
 * 
 * keys: tenant_id TEXT -> UUID
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

// Ordered roughly parents first to minimize FK friction (though ALTER TYPE usually cascade handles or requires ordered updates)
const TABLES_TO_MIGRATE = [
    'services',
    'locations',
    'suppliers',
    
    'admissions',
    'prescriptions',
    'appointments',
    'medication_dispense_events',
    
    'actes',
    'product_configs',
    'product_suppliers',
    'product_price_versions',
    
    'purchase_orders',
    'po_items',
    
    'delivery_notes',
    'delivery_note_lines',
    'delivery_note_layers',
    
    'stock_transfers',
    'stock_transfer_lines',
    'stock_demand_lines', // Parent stock_demands is already UUID
    
    'stock_returns'
];

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);
    
    for (const table of TABLES_TO_MIGRATE) {
        process.stdout.write(`  ${table}... `);
        try {
            // Check if column exists and is not UUID
            // Actually explicit ALTER is cleaner, let PG handle idempotency checks or catch errors
            
            await tenantQuery(tenantId, `
                ALTER TABLE "${table}" 
                ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid
            `);
            console.log('✓ OK');
        } catch (e: any) {
            if (e.message.includes('already of type uuid')) {
                console.log('✓ (already UUID)');
            } else if (e.message.includes('undefined_table') || e.message.includes('does not exist')) {
                console.log('⚠️ Table not found (skipping)');
            } else {
                console.log(`❌ ERROR: ${e.message}`);
                // Continue to next table? Yes, keep going.
            }
        }
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: Tenant ID Normalization (Apply 018)');
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
