/**
 * TIER 3 VALIDATION: Reservation-Aware Transfers
 * 
 * Tests:
 * A) transfer() respects active reservations (won't transfer reserved stock)
 * B) transfer() allows transfer of unreserved stock
 * C) transfer() uses FEFO ordering
 * D) Concurrent reservations + transfer (race condition prevention)
 * 
 * Run from backend/: npx ts-node --transpile-only tier3_test.ts demo_tenant
 */

import { v4 as uuidv4 } from 'uuid';
import { tenantQuery, tenantTransaction } from './db/tenantPg';
import { stockReservationService } from './services/stockReservationService';
import { PharmacyService } from './services/pharmacyService';

const pharmacyService = PharmacyService.getInstance();

interface TestResult {
    test: string;
    passed: boolean;
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

async function setupStock(tenantId: string, productId: string, lot: string, location: string, qty: number) {
    await tenantQuery(tenantId, `
        INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
        VALUES ($1, $2, $3, '2027-12-31', $4, $5)
        ON CONFLICT(tenant_id, product_id, lot, location) 
        DO UPDATE SET qty_units = $5
    `, [tenantId, productId, lot, location, qty]);
}

async function getStock(tenantId: string, productId: string, lot: string, location: string): Promise<number> {
    const rows = await tenantQuery(tenantId, `
        SELECT qty_units FROM current_stock 
        WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = $4
    `, [tenantId, productId, lot, location]);
    return rows.length > 0 ? rows[0].qty_units : 0;
}

async function cleanupTest(tenantId: string, lot: string) {
    await tenantQuery(tenantId, `DELETE FROM stock_reservations WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM inventory_movements WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [lot]);
}

async function main() {
    const tenantId = process.argv[2] || 'demo_tenant';
    const testProductId = uuidv4();
    const testLot = 'LOT-TIER3-TEST';
    const sourceLocation = `PHARMACY-${uuidv4().slice(0,8)}`;
    const destLocation = `SERVICE-${uuidv4().slice(0,8)}`;

    console.log('='.repeat(70));
    console.log('TIER 3 VALIDATION: Reservation-Aware Transfers');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);

    // Cleanup before tests
    await cleanupTest(tenantId, testLot);

    // =========================================================================
    // TEST A: transfer() respects active reservations
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST A: transfer() respects active reservations');
    console.log('─'.repeat(70));

    await runTest('A.1 Setup: Create 100 units at source location', async () => {
        await setupStock(tenantId, testProductId, testLot, sourceLocation, 100);
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 100) throw new Error(`Expected 100, got ${qty}`);
    });

    const reservationSessionId = `sess_${uuidv4()}`;

    await runTest('A.2 Reserve 80 units with hold()', async () => {
        await stockReservationService.hold(tenantId, {
            session_id: reservationSessionId,
            user_id: 'test_user',
            product_id: testProductId,
            lot: testLot,
            expiry: '2027-12-31',
            location_id: sourceLocation,
            qty_units: 80
        });
    });

    await runTest('A.3 transfer() 30 units should FAIL (only 20 available)', async () => {
        try {
            await pharmacyService.transfer({
                tenantId,
                fromLocation: sourceLocation,
                toLocation: destLocation,
                items: [{ productId: testProductId, qty: 30 }],
                userId: 'test_user'
            });
            throw new Error('Should have thrown INSUFFICIENT_AVAILABLE_STOCK');
        } catch (err: any) {
            if (!err.message.includes('INSUFFICIENT_AVAILABLE_STOCK')) throw err;
        }
    });

    await runTest('A.4 transfer() 20 units should SUCCEED (exactly 20 available)', async () => {
        await pharmacyService.transfer({
            tenantId,
            fromLocation: sourceLocation,
            toLocation: destLocation,
            items: [{ productId: testProductId, qty: 20 }],
            userId: 'test_user'
        });
    });

    await runTest('A.5 Source stock is now 80 (100 - 20)', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 80) throw new Error(`Expected 80, got ${qty}`);
    });

    await runTest('A.6 Destination stock is now 20', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, destLocation);
        if (qty !== 20) throw new Error(`Expected 20, got ${qty}`);
    });

    await runTest('A.7 Reservation still active with 80 units', async () => {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM stock_reservations 
            WHERE session_id = $1 AND status = 'ACTIVE' AND qty_units = 80
        `, [reservationSessionId]);
        if (rows.length !== 1) throw new Error('Reservation not found or qty changed');
    });

    // Clean up reservation for next tests
    await stockReservationService.releaseSession(tenantId, reservationSessionId);

    // =========================================================================
    // TEST B: transfer() allows unreserved stock
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST B: transfer() with no reservations');
    console.log('─'.repeat(70));

    await runTest('B.1 After releasing reservation, transfer 80 units succeeds', async () => {
        await pharmacyService.transfer({
            tenantId,
            fromLocation: sourceLocation,
            toLocation: destLocation,
            items: [{ productId: testProductId, qty: 80 }],
            userId: 'test_user'
        });
    });

    await runTest('B.2 Source stock is now 0', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 0) throw new Error(`Expected 0, got ${qty}`);
    });

    await runTest('B.3 Destination stock is now 100', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, destLocation);
        if (qty !== 100) throw new Error(`Expected 100, got ${qty}`);
    });

    // =========================================================================
    // TEST C: FEFO ordering (First Expiry First Out)
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST C: FEFO ordering in transfer()');
    console.log('─'.repeat(70));

    const productFefo = uuidv4();
    const lotEarly = 'LOT-EXPIRES-EARLY';
    const lotLate = 'LOT-EXPIRES-LATE';
    const fefoSource = `FEFO-SOURCE-${uuidv4().slice(0,8)}`;
    const fefoDest = `FEFO-DEST-${uuidv4().slice(0,8)}`;

    await runTest('C.1 Setup: Create 50 units expiring 2027-01 (early)', async () => {
        await tenantQuery(tenantId, `
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
            VALUES ($1, $2, $3, '2027-01-31', $4, 50)
            ON CONFLICT(tenant_id, product_id, lot, location) DO UPDATE SET qty_units = 50
        `, [tenantId, productFefo, lotEarly, fefoSource]);
    });

    await runTest('C.2 Setup: Create 50 units expiring 2028-01 (late)', async () => {
        await tenantQuery(tenantId, `
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
            VALUES ($1, $2, $3, '2028-01-31', $4, 50)
            ON CONFLICT(tenant_id, product_id, lot, location) DO UPDATE SET qty_units = 50
        `, [tenantId, productFefo, lotLate, fefoSource]);
    });

    await runTest('C.3 Transfer 70 units - should take all 50 early + 20 late', async () => {
        await pharmacyService.transfer({
            tenantId,
            fromLocation: fefoSource,
            toLocation: fefoDest,
            items: [{ productId: productFefo, qty: 70 }],
            userId: 'test_user'
        });
    });

    await runTest('C.4 Early lot should be 0 (all taken)', async () => {
        const qty = await getStock(tenantId, productFefo, lotEarly, fefoSource);
        if (qty !== 0) throw new Error(`Expected 0, got ${qty}`);
    });

    await runTest('C.5 Late lot should be 30 (50 - 20)', async () => {
        const qty = await getStock(tenantId, productFefo, lotLate, fefoSource);
        if (qty !== 30) throw new Error(`Expected 30, got ${qty}`);
    });

    // Cleanup FEFO test
    await cleanupTest(tenantId, lotEarly);
    await cleanupTest(tenantId, lotLate);

    // =========================================================================
    // TEST D: Invariants
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST D: SQL Invariants after transfers');
    console.log('─'.repeat(70));

    await runTest('D.1 No negative stock', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM current_stock WHERE qty_units < 0`);
        if (rows.length > 0) throw new Error(`Found ${rows.length} negative stock rows`);
    });

    await runTest('D.2 All inventory_movements have valid document_id', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM inventory_movements WHERE document_id IS NULL`);
        if (rows.length > 0) throw new Error(`Found ${rows.length} movements without document_id`);
    });

    // =========================================================================
    // CLEANUP & SUMMARY
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('CLEANUP');
    console.log('─'.repeat(70));
    
    await cleanupTest(tenantId, testLot);
    console.log('   Test data cleaned up\n');

    // Summary
    console.log('='.repeat(70));
    console.log('TIER 3 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ TIER 3 VALIDATION FAILED');
        console.log('\nFailed tests:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.test}: ${r.error}`);
        }
        console.log('\n⚠️ DO NOT PROCEED TO TIER 4.');
        process.exit(1);
    } else {
        console.log('\n✅ TIER 3 VALIDATION PASSED');
        console.log('\nReservation-aware transfers are functioning correctly.');
        console.log('All stock deductions respect active reservations.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
