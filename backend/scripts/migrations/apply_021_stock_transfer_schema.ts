/**
 * Migration 021: Stock Transfer Schema Refactor
 * 
 * Objectives:
 * 1. stock_transfer_lines: Convert source_location_id, destination_location_id to UUID.
 * 2. stock_transfers: Drop source_location_id, destination_location_id.
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);
    
    // 1. Resolve Pharmacy Location for mapping 'PHARMACY_MAIN'
    const pharmLocRes = await tenantQuery(tenantId, "SELECT location_id FROM locations WHERE scope = 'PHARMACY' LIMIT 1");
    const pharmacyLocId = pharmLocRes[0]?.location_id;
    
    if (pharmacyLocId) {
        // Update any 'PHARMACY_MAIN' text in lines
        await tenantQuery(tenantId, `
            UPDATE stock_transfer_lines 
            SET source_location_id = '${pharmacyLocId}'
            WHERE source_location_id = 'PHARMACY_MAIN'
        `);
         await tenantQuery(tenantId, `
            UPDATE stock_transfer_lines 
            SET destination_location_id = '${pharmacyLocId}'
            WHERE destination_location_id = 'PHARMACY_MAIN'
        `);
        console.log('    ✓ Mapped PHARMACY_MAIN to UUID in lines');
    } else {
        console.log('    ⚠️ No Pharmacy location found, skipping static text mapping');
    }

    // 2. Convert Lines Columns to UUID
    try {
        await tenantQuery(tenantId, `
            ALTER TABLE stock_transfer_lines 
            ALTER COLUMN source_location_id TYPE UUID USING source_location_id::uuid,
            ALTER COLUMN destination_location_id TYPE UUID USING destination_location_id::uuid
        `);
        console.log('    ✓ stock_transfer_lines locations → UUID');
    } catch (e: any) {
        if (e.message.includes('already of type uuid')) {
             console.log('    ✓ stock_transfer_lines locations already UUID');
        } else {
            console.error(`    ❌ Error converting lines: ${e.message}`);
        }
    }

    // 3. Drop Header Columns
    try {
        await tenantQuery(tenantId, `
            ALTER TABLE stock_transfers 
            DROP COLUMN IF EXISTS source_location_id,
            DROP COLUMN IF EXISTS destination_location_id
        `);
        console.log('    ✓ Dropped stock_transfers header locations');
    } catch (e: any) {
        console.error(`    ❌ Error dropping header columns: ${e.message}`);
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: Stock Transfer Refactor (Apply 021)');
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
    
    console.log('\n✅ MIGRATION 021 COMPLETE');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
