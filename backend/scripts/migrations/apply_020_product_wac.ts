/**
 * Migration 020: Normalize tenant_id for product_wac
 */

import { tenantQuery, closeAllTenantPools } from '../../db/tenantPg';
import { globalQuery, closeGlobalPool } from '../../db/globalPg';

const TABLES_TO_MIGRATE = ['product_wac'];

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating tenant: ${tenantId} ===`);
    
    for (const table of TABLES_TO_MIGRATE) {
        process.stdout.write(`  ${table}... `);
        try {
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
            }
        }
    }
}

async function main() {
    console.log('================================================');
    console.log('MIGRATION: Fix Product WAC (Apply 020)');
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
    
    console.log('\n✅ MIGRATION 020 COMPLETE');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
