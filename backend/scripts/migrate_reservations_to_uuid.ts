/**
 * Migrate stock_reservations location columns from TEXT to UUID
 * to match current_stock.location type after multi-tenant architecture update.
 * 
 * Run from backend/: npx ts-node --transpile-only scripts/migrate_reservations_to_uuid.ts demo_tenant
 */

import { tenantTransaction, tenantQuery } from '../db/tenantPg';

async function run() {
    const tenantId = process.argv[2] || 'demo_tenant';
    
    console.log('='.repeat(70));
    console.log('MIGRATE STOCK_RESERVATIONS LOCATION COLUMNS TO UUID');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);
    
    await tenantTransaction(tenantId, async (client) => {
        console.log('1. Checking for non-UUID values...');
        
        // Check if there are any non-UUID values
        const invalid = await client.query(`
            SELECT location_id FROM stock_reservations 
            WHERE location_id IS NOT NULL 
            AND location_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            LIMIT 5
        `);
        
        if (invalid.rows.length > 0) {
            console.log('   Found non-UUID values:', invalid.rows);
            throw new Error('Cannot convert without fixing data first');
        }
        console.log('   ✅ All values are valid UUIDs or NULL');
        
        // Convert location_id to UUID
        console.log('2. Converting location_id to UUID type...');
        await client.query(`
            ALTER TABLE stock_reservations 
            ALTER COLUMN location_id TYPE UUID USING location_id::UUID
        `);
        console.log('   ✅ stock_reservations.location_id converted to UUID');
        
        // Convert destination_location_id to UUID
        console.log('3. Converting destination_location_id to UUID type...');
        await client.query(`
            ALTER TABLE stock_reservations 
            ALTER COLUMN destination_location_id TYPE UUID USING destination_location_id::UUID
        `);
        console.log('   ✅ stock_reservations.destination_location_id converted to UUID');
        
        // Add composite FK for location_id
        console.log('4. Adding composite FK constraint for location_id...');
        await client.query(`ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS fk_res_location_tenant`);
        await client.query(`
            ALTER TABLE stock_reservations
            ADD CONSTRAINT fk_res_location_tenant
            FOREIGN KEY (tenant_id, location_id)
            REFERENCES locations (tenant_id, location_id)
            ON DELETE RESTRICT
            NOT VALID
        `);
        console.log('   ✅ Added composite FK for location_id');
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
}

run().catch(e => {
    console.error('\n❌ MIGRATION FAILED:', e.message);
    process.exit(1);
});
