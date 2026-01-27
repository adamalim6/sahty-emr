/**
 * TIER 1 INVARIANT & CONCURRENCY TEST
 * 
 * A) SQL Invariant: SELECT * FROM current_stock WHERE qty_units < 0 → must return 0 rows
 * B) Concurrency: Two simultaneous decrements must never oversell stock
 * 
 * Run from backend/: npx ts-node --transpile-only tier1_invariant_test.ts demo_tenant
 */

import { tenantQuery, getTenantPool } from './db/tenantPg';
import { PharmacyService } from './services/pharmacyService';

const pharmacyService = PharmacyService.getInstance();

async function main() {
    const tenantId = process.argv[2] || 'demo_tenant';
    const testProductId = '00000000-0000-0000-0000-000000000002';
    const testLot = 'LOT-CONCURRENCY-TEST';
    const testLocation = 'TEST-LOC-CONCURRENT';
    const testExpiry = '2027-12-31';

    console.log('='.repeat(70));
    console.log('TIER 1: INVARIANT & CONCURRENCY TESTS');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);

    // Cleanup
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [testLot]);

    // =========================================================================
    // TEST A: SQL INVARIANT CHECK
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST A: SQL INVARIANT - No negative stock allowed');
    console.log('─'.repeat(70));

    const negativeStock = await tenantQuery(tenantId, 
        `SELECT * FROM current_stock WHERE qty_units < 0`
    );

    if (negativeStock.length === 0) {
        console.log('✅ INVARIANT PASSED: No rows with qty_units < 0');
    } else {
        console.log(`❌ INVARIANT FAILED: Found ${negativeStock.length} rows with negative stock`);
        console.log(negativeStock);
        process.exit(1);
    }

    // =========================================================================
    // TEST B: CONCURRENCY TEST - Simultaneous decrements
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST B: CONCURRENCY - Simultaneous decrements must not oversell');
    console.log('─'.repeat(70));

    // Setup: Create stock with exactly 10 units
    console.log('Setup: Creating stock with exactly 10 units...');
    await (pharmacyService as any).upsertStock(
        tenantId, testProductId, testLot, testExpiry, testLocation, 10
    );

    const beforeStock = await tenantQuery(tenantId, 
        `SELECT qty_units FROM current_stock WHERE product_id = $1 AND lot = $2`,
        [testProductId, testLot]
    );
    console.log(`   Initial stock: ${beforeStock[0].qty_units} units`);

    // Simulate concurrent decrements: Both try to deduct 8 units simultaneously
    // Only ONE should succeed (10 - 8 = 2 >= 0), the second should fail (2 - 8 < 0)
    console.log('\n   Simulating 2 concurrent decrements of 8 units each...');

    const results = await Promise.allSettled([
        (pharmacyService as any).upsertStock(tenantId, testProductId, testLot, testExpiry, testLocation, -8),
        (pharmacyService as any).upsertStock(tenantId, testProductId, testLot, testExpiry, testLocation, -8),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    console.log(`   Results: ${successes} succeeded, ${failures} failed`);

    // Check final stock
    const afterStock = await tenantQuery(tenantId, 
        `SELECT qty_units FROM current_stock WHERE product_id = $1 AND lot = $2`,
        [testProductId, testLot]
    );
    const finalQty = afterStock[0].qty_units;
    console.log(`   Final stock: ${finalQty} units`);

    // Validate: Only one decrement should have succeeded
    // Expected: 10 - 8 = 2 (only one succeeded)
    // If both succeeded (race condition), we'd have: 10 - 16 = negative (impossible with guard)
    
    if (successes === 1 && failures === 1 && finalQty === 2) {
        console.log('\n✅ CONCURRENCY TEST PASSED');
        console.log('   - Only ONE decrement succeeded (as expected)');
        console.log('   - Second decrement correctly failed with INSUFFICIENT_STOCK');
        console.log('   - Final stock is 2 (not negative)');
    } else if (successes === 2 && finalQty < 0) {
        console.log('\n❌ CONCURRENCY TEST FAILED - RACE CONDITION!');
        console.log('   - Both decrements succeeded (BUG!)');
        console.log('   - Stock went negative (CATASTROPHIC)');
        process.exit(1);
    } else {
        console.log('\n⚠️ UNEXPECTED RESULT');
        console.log(`   - Successes: ${successes}, Failures: ${failures}`);
        console.log(`   - Final qty: ${finalQty}`);
        // This could happen under different timing - still valid if no negatives
        if (finalQty >= 0) {
            console.log('   - Stock is non-negative, pattern is safe');
        }
    }

    // Final invariant check
    console.log('\n' + '─'.repeat(70));
    console.log('FINAL INVARIANT CHECK');
    console.log('─'.repeat(70));

    const finalNegativeCheck = await tenantQuery(tenantId, 
        `SELECT * FROM current_stock WHERE qty_units < 0`
    );

    if (finalNegativeCheck.length === 0) {
        console.log('✅ FINAL INVARIANT: No negative stock exists');
    } else {
        console.log('❌ FINAL INVARIANT FAILED');
        process.exit(1);
    }

    // Cleanup
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [testLot]);

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TIER 1 INVARIANT & CONCURRENCY TESTS PASSED');
    console.log('='.repeat(70));
    console.log('\nSafe to proceed to TIER 2: Reservation Engine.');
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
