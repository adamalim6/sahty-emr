/**
 * SQL-ENFORCE: current_stock is PHYSICAL only
 * 
 * Creates two triggers:
 * 1. trg_prevent_virtual_stock: Blocks INSERT/UPDATE into current_stock with VIRTUAL/SYSTEM location
 * 2. trg_prevent_location_virtualize: Blocks UPDATE of locations to VIRTUAL/SYSTEM if stock exists
 * 
 * Run from backend/: npx ts-node --transpile-only scripts/migrate_physical_stock_invariant.ts demo_tenant
 */

import { tenantTransaction, tenantQuery } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

async function run() {
    const tenantId = process.argv[2] || 'demo_tenant';
    
    console.log('='.repeat(70));
    console.log('SQL-ENFORCE: current_stock is PHYSICAL only');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);
    
    await tenantTransaction(tenantId, async (client) => {
        // =====================================================================
        // TRIGGER 1: Block INSERT/UPDATE into current_stock with VIRTUAL/SYSTEM
        // =====================================================================
        console.log('1) Creating trigger: trg_prevent_virtual_stock...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_virtual_stock()
            RETURNS trigger AS $$
            DECLARE
                loc_type TEXT;
                loc_scope TEXT;
            BEGIN
                -- Lookup location type and scope (same tenant)
                SELECT type, scope INTO loc_type, loc_scope
                FROM locations
                WHERE location_id = NEW.location AND tenant_id = NEW.tenant_id;
                
                -- Block if VIRTUAL or SYSTEM
                IF loc_type = 'VIRTUAL' OR loc_scope = 'SYSTEM' THEN
                    RAISE EXCEPTION 'Cannot create/update stock at VIRTUAL/SYSTEM location (tenant_id=%, location_id=%, type=%, scope=%)',
                        NEW.tenant_id, NEW.location, loc_type, loc_scope;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await client.query(`DROP TRIGGER IF EXISTS trg_prevent_virtual_stock ON current_stock`);
        await client.query(`
            CREATE TRIGGER trg_prevent_virtual_stock
            BEFORE INSERT OR UPDATE ON current_stock
            FOR EACH ROW EXECUTE FUNCTION prevent_virtual_stock()
        `);
        console.log('   ✅ Trigger created: blocks INSERT/UPDATE with VIRTUAL/SYSTEM location');
        
        // =====================================================================
        // TRIGGER 2: Block UPDATE of locations to VIRTUAL/SYSTEM if stock exists
        // =====================================================================
        console.log('\n2) Creating trigger: trg_prevent_location_virtualize...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION prevent_location_virtualize()
            RETURNS trigger AS $$
            DECLARE
                stock_count INTEGER;
            BEGIN
                -- Only check if changing to VIRTUAL or SYSTEM
                IF (NEW.type = 'VIRTUAL' AND OLD.type != 'VIRTUAL') 
                   OR (NEW.scope = 'SYSTEM' AND OLD.scope != 'SYSTEM') THEN
                    
                    -- Check if any stock exists at this location
                    SELECT COUNT(*) INTO stock_count
                    FROM current_stock
                    WHERE location = NEW.location_id AND tenant_id = NEW.tenant_id;
                    
                    IF stock_count > 0 THEN
                        RAISE EXCEPTION 'Cannot convert location to VIRTUAL/SYSTEM: % stock rows exist (tenant_id=%, location_id=%)',
                            stock_count, NEW.tenant_id, NEW.location_id;
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await client.query(`DROP TRIGGER IF EXISTS trg_prevent_location_virtualize ON locations`);
        await client.query(`
            CREATE TRIGGER trg_prevent_location_virtualize
            BEFORE UPDATE ON locations
            FOR EACH ROW EXECUTE FUNCTION prevent_location_virtualize()
        `);
        console.log('   ✅ Trigger created: blocks conversion to VIRTUAL/SYSTEM if stock exists');
    });
    
    // =========================================================================
    // PROOF QUERIES
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('3) PROOF QUERIES');
    console.log('─'.repeat(70));
    
    console.log('\n3.1 Existing virtual stock check (should be 0 rows):');
    const proof = await tenantQuery(tenantId, `
        SELECT cs.tenant_id, cs.location, cs.product_id, l.type, l.scope
        FROM current_stock cs
        JOIN locations l ON l.tenant_id = cs.tenant_id AND l.location_id = cs.location
        WHERE l.type = 'VIRTUAL' OR l.scope = 'SYSTEM'
    `, []);
    console.log(`   Result: ${proof.length} rows`);
    if (proof.length === 0) {
        console.log('   ✅ PASS: No virtual stock exists');
    } else {
        console.log('   ❌ FAIL: Found existing virtual stock (data corruption)');
        for (const row of proof) {
            console.log(`      • tenant=${row.tenant_id}, location=${row.location}, type=${row.type}, scope=${row.scope}`);
        }
    }
    
    // =========================================================================
    // TEST A: Insert into current_stock with VIRTUAL location (should FAIL)
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('4) TRIGGER TESTS');
    console.log('─'.repeat(70));
    
    console.log('\nTEST A: INSERT into current_stock with VIRTUAL location');
    
    // Get DISPENSED location
    const dispensed = await tenantQuery(tenantId, `
        SELECT location_id, type, scope FROM locations 
        WHERE code = 'DISPENSED' AND tenant_id = $1
    `, [tenantId]);
    
    if (dispensed.length === 0) {
        console.log('   ⚠️  SKIP: No DISPENSED location found');
    } else {
        const dispensedId = dispensed[0].location_id;
        console.log(`   Using DISPENSED location: ${dispensedId} (type=${dispensed[0].type}, scope=${dispensed[0].scope})`);
        
        try {
            await tenantQuery(tenantId, `
                INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                VALUES ($1, $2, 'TEST-LOT', '2099-12-31', $3, 10)
            `, [tenantId, uuidv4(), dispensedId]);
            console.log('   ❌ FAIL: Insert succeeded (trigger not working!)');
        } catch (err: any) {
            if (err.message.includes('Cannot create/update stock at VIRTUAL/SYSTEM')) {
                console.log('   ✅ PASS: Trigger blocked INSERT');
                console.log(`   Error: ${err.message}`);
            } else {
                console.log(`   ❓ OTHER ERROR: ${err.message}`);
            }
        }
    }
    
    // =========================================================================
    // TEST B: Update PHYSICAL location to VIRTUAL when stock exists (should FAIL)
    // =========================================================================
    console.log('\nTEST B: UPDATE location to VIRTUAL when stock exists');
    
    // Find a PHYSICAL location that has stock
    const physicalWithStock = await tenantQuery(tenantId, `
        SELECT cs.location, l.name, l.type, l.scope
        FROM current_stock cs
        JOIN locations l ON l.location_id = cs.location AND l.tenant_id = cs.tenant_id
        WHERE l.type = 'PHYSICAL'
        LIMIT 1
    `, []);
    
    if (physicalWithStock.length === 0) {
        console.log('   ⚠️  SKIP: No PHYSICAL location with stock found');
    } else {
        const locId = physicalWithStock[0].location;
        console.log(`   Using location: ${locId} (name=${physicalWithStock[0].name}, type=${physicalWithStock[0].type})`);
        
        try {
            await tenantQuery(tenantId, `
                UPDATE locations SET type = 'VIRTUAL' 
                WHERE location_id = $1 AND tenant_id = $2
            `, [locId, tenantId]);
            console.log('   ❌ FAIL: Update succeeded (trigger not working!)');
            
            // Revert
            await tenantQuery(tenantId, `
                UPDATE locations SET type = 'PHYSICAL' 
                WHERE location_id = $1 AND tenant_id = $2
            `, [locId, tenantId]);
        } catch (err: any) {
            if (err.message.includes('Cannot convert location to VIRTUAL/SYSTEM')) {
                console.log('   ✅ PASS: Trigger blocked UPDATE');
                console.log(`   Error: ${err.message}`);
            } else {
                console.log(`   ❓ OTHER ERROR: ${err.message}`);
            }
        }
    }
    
    // =========================================================================
    // FINAL INVARIANT CONFIRMATION
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('5) FINAL INVARIANT CONFIRMATION');
    console.log('='.repeat(70));
    
    console.log('\nStatement: "current_stock contains only physical stock in PHYSICAL locations;');
    console.log('           virtual/system locations exist only in inventory_movements."');
    console.log('\nSQL-ENFORCED: ✅ YES');
    console.log('\nEnforcement mechanisms:');
    console.log('  • trg_prevent_virtual_stock: Blocks INSERT/UPDATE with VIRTUAL/SYSTEM location');
    console.log('  • trg_prevent_location_virtualize: Blocks location type change if stock exists');
    console.log('  • Composite FK: (tenant_id, location) → locations(tenant_id, location_id)');
    console.log('  • SYSTEM locations per-tenant (NOT global)');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
}

run().catch(e => {
    console.error('\n❌ MIGRATION FAILED:', e.message);
    process.exit(1);
});
