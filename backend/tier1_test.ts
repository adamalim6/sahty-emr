/**
 * TIER 1 VALIDATION: upsertStock() and getStock()
 * 
 * Tests atomic stock operations before proceeding to TIER 2.
 * Run from backend/: npx ts-node --transpile-only tier1_test.ts [tenantId]
 */

import { tenantQuery, tenantTransaction, getTenantPool } from './db/tenantPg';
import { PharmacyService } from './services/pharmacyService';

const pharmacyService = PharmacyService.getInstance();

interface TestResult {
    test: string;
    passed: boolean;
    details?: any;
    error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
        console.log(`✅ ${name}`);
        results.push({ test: name, passed: true });
    } catch (err: any) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${err.message}`);
        results.push({ test: name, passed: false, error: err.message });
    }
}

async function main() {
    const tenantId = process.argv[2] || 'tier1_test';
    const testProductId = '00000000-0000-0000-0000-000000000001';
    const testLot = 'LOT-TIER1-TEST';
    const testLocation = 'TEST-LOC-A';
    const testExpiry = '2027-12-31';

    console.log('='.repeat(70));
    console.log('TIER 1 VALIDATION: upsertStock() and getStock()');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}`);
    console.log(`Test Product ID: ${testProductId}`);
    console.log('');

    // Pre-test: Ensure tenant DB exists
    try {
        await tenantQuery(tenantId, 'SELECT 1', []);
    } catch (err: any) {
        if (err.message.includes('does not exist')) {
            console.log('❌ Tenant database does not exist. Create it first with create_empty_tenant.ts');
            process.exit(1);
        }
        throw err;
    }

    // Clean up any previous test data
    console.log('─'.repeat(70));
    console.log('CLEANUP: Removing previous test data...');
    console.log('─'.repeat(70));
    
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [testLot]);
    console.log('   Cleaned up previous test stock\n');

    // =========================================================================
    // TEST 1: upsertStock() - INSERT
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST 1: upsertStock() - INSERT NEW STOCK');
    console.log('─'.repeat(70));

    await runTest('1.1 Insert 100 units via upsertStock', async () => {
        // Access private method via any cast (for testing only)
        await (pharmacyService as any).upsertStock(
            tenantId, testProductId, testLot, testExpiry, testLocation, 100
        );
    });

    await runTest('1.2 Verify stock created with 100 units', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT qty_units FROM current_stock WHERE product_id = $1 AND lot = $2 AND location = $3`,
            [testProductId, testLot, testLocation]
        );
        if (rows.length !== 1) throw new Error(`Expected 1 row, got ${rows.length}`);
        if (rows[0].qty_units !== 100) throw new Error(`Expected 100 units, got ${rows[0].qty_units}`);
    });

    // =========================================================================
    // TEST 2: upsertStock() - ATOMIC INCREMENT
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 2: upsertStock() - ATOMIC INCREMENT');
    console.log('─'.repeat(70));

    await runTest('2.1 Add 50 more units via upsertStock', async () => {
        await (pharmacyService as any).upsertStock(
            tenantId, testProductId, testLot, testExpiry, testLocation, 50
        );
    });

    await runTest('2.2 Verify stock is now 150 units (100 + 50)', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT qty_units FROM current_stock WHERE product_id = $1 AND lot = $2 AND location = $3`,
            [testProductId, testLot, testLocation]
        );
        if (rows[0].qty_units !== 150) throw new Error(`Expected 150 units, got ${rows[0].qty_units}`);
    });

    // =========================================================================
    // TEST 3: upsertStock() - ATOMIC DECREMENT
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 3: upsertStock() - ATOMIC DECREMENT');
    console.log('─'.repeat(70));

    await runTest('3.1 Deduct 30 units via upsertStock (negative delta)', async () => {
        await (pharmacyService as any).upsertStock(
            tenantId, testProductId, testLot, testExpiry, testLocation, -30
        );
    });

    await runTest('3.2 Verify stock is now 120 units (150 - 30)', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT qty_units FROM current_stock WHERE product_id = $1 AND lot = $2 AND location = $3`,
            [testProductId, testLot, testLocation]
        );
        if (rows[0].qty_units !== 120) throw new Error(`Expected 120 units, got ${rows[0].qty_units}`);
    });

    // =========================================================================
    // TEST 4: getStock() - BASIC QUERY
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 4: getStock() - BASIC QUERY');
    console.log('─'.repeat(70));

    await runTest('4.1 getStock(tenantId) returns test stock', async () => {
        const stock = await pharmacyService.getStock(tenantId);
        const testItem = stock.find(s => s.lot === testLot);
        if (!testItem) throw new Error('Test stock not found in getStock result');
        if (testItem.qtyUnits !== 120) throw new Error(`Expected 120 units, got ${testItem.qtyUnits}`);
    });

    await runTest('4.2 getStock(tenantId, location) filters correctly', async () => {
        const stock = await pharmacyService.getStock(tenantId, testLocation);
        const testItem = stock.find(s => s.lot === testLot);
        if (!testItem) throw new Error('Test stock not found when filtering by location');
    });

    await runTest('4.3 getStock(tenantId, location, productId) filters correctly', async () => {
        const stock = await pharmacyService.getStock(tenantId, testLocation, testProductId);
        if (stock.length !== 1) throw new Error(`Expected 1 item, got ${stock.length}`);
        if (stock[0].qtyUnits !== 120) throw new Error(`Expected 120 units, got ${stock[0].qtyUnits}`);
    });

    await runTest('4.4 getStock excludes zero/negative stock', async () => {
        // Deduct all remaining stock
        await (pharmacyService as any).upsertStock(
            tenantId, testProductId, testLot, testExpiry, testLocation, -120
        );
        const stock = await pharmacyService.getStock(tenantId, testLocation, testProductId);
        if (stock.length !== 0) throw new Error(`Expected 0 items (zero stock excluded), got ${stock.length}`);
    });

    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('CLEANUP');
    console.log('─'.repeat(70));
    
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [testLot]);
    console.log('   Test data cleaned up\n');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('='.repeat(70));
    console.log('TIER 1 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ TIER 1 VALIDATION FAILED');
        console.log('\nFailed tests:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.test}: ${r.error}`);
        }
        console.log('\n⚠️ DO NOT PROCEED TO TIER 2.');
        process.exit(1);
    } else {
        console.log('\n✅ TIER 1 VALIDATION PASSED');
        console.log('\nupsertStock() and getStock() are functioning correctly.');
        console.log('Ready to proceed to TIER 2: Reservation Engine.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('TIER 1 test failed:', err);
    process.exit(1);
});
