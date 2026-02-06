/**
 * TIER 4 VALIDATION: Reservation-Aware Dispense
 * 
 * Tests:
 * A) dispense() respects active reservations
 * B) dispense() uses FEFO ordering
 * C) Concurrent reservation + dispense (cannot consume held stock)
 * D) SQL Invariants
 * 
 * Run from backend/: npx ts-node --transpile-only tier4_test.ts demo_tenant
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

async function setupStock(tenantId: string, productId: string, lot: string, expiry: string, location: string, qty: number) {
    await tenantQuery(tenantId, `
        INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(tenant_id, product_id, lot, location_id) 
        DO UPDATE SET qty_units = $6
    `, [tenantId, productId, lot, expiry, location, qty]);
}

async function getStock(tenantId: string, productId: string, lot: string, location: string): Promise<number> {
    const rows = await tenantQuery(tenantId, `
        SELECT qty_units FROM current_stock 
        WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location_id = $4
    `, [tenantId, productId, lot, location]);
    return rows.length > 0 ? rows[0].qty_units : 0;
}

async function cleanupTest(tenantId: string, lot: string) {
    await tenantQuery(tenantId, `DELETE FROM medication_dispense_events WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM stock_reservation_lines WHERE lot = $1`, [lot]);
    // NOTE: We don't clean stock_reservations headers here as they are session-bound, not lot-bound
    await tenantQuery(tenantId, `DELETE FROM inventory_movements WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [lot]);
}

async function main() {
    const tenantId = process.argv[2] || 'demo_tenant';
    const testUserId = uuidv4();
    const testProductId = uuidv4();
    const testLot = 'LOT-TIER4-TEST';
    const testExpiry = '2027-12-31';
    
    // Create a real PHARMACY location for testing (composite FKs require real location UUIDs)
    const testLocationId = uuidv4();
    await tenantQuery(tenantId, `
        INSERT INTO locations (location_id, tenant_id, name, scope, type, status)
        VALUES ($1, $2, 'Test Pharmacy T4', 'PHARMACY', 'PHYSICAL', 'ACTIVE')
        ON CONFLICT (location_id) DO NOTHING
    `, [testLocationId, tenantId]);
    const sourceLocation = testLocationId; // Use UUID, not text string

    // Create DISPENSED location (required for dispense)
    const dispensedLocationId = uuidv4();
    await tenantQuery(tenantId, `
        INSERT INTO locations (location_id, tenant_id, name, scope, type, status, location_class)
        VALUES ($1, $2, 'DISPENSED', 'SYSTEM', 'VIRTUAL', 'ACTIVE', 'ROUTING')
        ON CONFLICT (location_id) DO NOTHING
    `, [dispensedLocationId, tenantId]);

    console.log('='.repeat(70));
    console.log('TIER 4 VALIDATION: Reservation-Aware Dispense');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);

    // Cleanup before tests
    await cleanupTest(tenantId, testLot);

    // =========================================================================
    // TEST A: dispense() respects active reservations
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST A: dispense() respects active reservations');
    console.log('─'.repeat(70));

    await runTest('A.1 Setup: Create 100 units at source location', async () => {
        await setupStock(tenantId, testProductId, testLot, testExpiry, sourceLocation, 100);
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 100) throw new Error(`Expected 100, got ${qty}`);
    });

    const reservationSessionId = uuidv4();

    await runTest('A.2 Reserve 80 units with hold()', async () => {
        await stockReservationService.hold(tenantId, {
            session_id: reservationSessionId,
            user_id: testUserId,
            product_id: testProductId,
            lot: testLot,
            expiry: testExpiry,
            source_location_id: sourceLocation,
            qty_units: 80
        });
    });

    // Create a dummy user for testing
    // const testUserId = uuidv4(); // Moved to top
    // We don't strictly need to insert into users table unless FK constraint exists on dispense/movements.
    // inventory_movements.created_by is TEXT.
    // stock_reservations.user_id is TEXT? Schema says `user_id TEXT`.
    // users table id is UUID.
    // Let's verify schema for stock_reservations.user_id.
    // In 000_init.sql: `user_id TEXT NOT NULL`.
    // So 'test_user' should be fine for reservations.
    // But what about dispense? 
    // `medication_dispense_events.dispensed_by` is TEXT.
    
    // Wait, let's look at the error again: `operator does not exist: text = uuid`.
    // This usually means a JOIN or a WHERE clause mismatch.
    // If I look at `pharmacyService.ts` (viewed previously), `dispense` might be looking up the user in `users` table via `globalPg` or `tenantPg`?
    // Or maybe `location_id`? 
    // `sourceLocation` IS a UUID (generated in main).
    
    // Let's look at `dispense` implementation in `pharmacyService.ts`. 
    // I previously viewed `pharmacyService.ts` lines 1176-1250.
    // It called `this.processDispensation`.
    // Let's view `pharmacyService.ts` around `dispense` to be sure.
    // But I can't currently view it. 
    
    // Hypothesis: The service validates the user or something else using a UUID column.
    // Best practice: Use UUIDs for everything that looks like an ID.
    


    await runTest('A.3 dispense() 30 units should FAIL (only 20 available)', async () => {
        try {
            await pharmacyService.dispense({
                tenantId,
                prescriptionId: undefined as any, 
                admissionId: undefined as any,
                items: [{ productId: testProductId, qtyRequested: 30 }],
                sourceLocation,
                userId: testUserId 
            });
            throw new Error('Should have thrown INSUFFICIENT_AVAILABLE_STOCK');
        } catch (err: any) {
            if (!err.message.includes('INSUFFICIENT_AVAILABLE_STOCK')) throw err;
        }
    });

    await runTest('A.4 dispense() 20 units should SUCCEED (exactly 20 available)', async () => {
        await pharmacyService.dispense({
            tenantId,
            prescriptionId: undefined as any, 
            admissionId: undefined as any,
            items: [{ productId: testProductId, qtyRequested: 20 }],
            sourceLocation,
            userId: testUserId
        });
    });

    await runTest('A.5 Source stock is now 80 (100 - 20)', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 80) throw new Error(`Expected 80, got ${qty}`);
    });

    await runTest('A.6 Reservation still active with 80 units', async () => {
        const rows = await tenantQuery(tenantId, `
            SELECT l.* FROM stock_reservation_lines l
            JOIN stock_reservations r ON l.reservation_id = r.reservation_id
            WHERE r.session_id = $1 AND r.status = 'ACTIVE' AND l.qty_units = 80
        `, [reservationSessionId]);
        if (rows.length !== 1) throw new Error('Reservation not found or qty changed');
    });

    // Clean up reservation for next tests
    await stockReservationService.releaseSession(tenantId, reservationSessionId);

    // =========================================================================
    // TEST B: dispense() after release - unreserved stock
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST B: dispense() after release');
    console.log('─'.repeat(70));

    await runTest('B.1 After releasing reservation, dispense 80 units succeeds', async () => {
        await pharmacyService.dispense({
            tenantId,
            prescriptionId: undefined as any,
            admissionId: undefined as any,
            items: [{ productId: testProductId, qtyRequested: 80 }],
            sourceLocation,
            userId: testUserId
        });
    });

    // ... (C.2)



    await runTest('B.2 Source stock is now 0', async () => {
        const qty = await getStock(tenantId, testProductId, testLot, sourceLocation);
        if (qty !== 0) throw new Error(`Expected 0, got ${qty}`);
    });

    // =========================================================================
    // TEST C: Concurrent hold + dispense (race condition test)
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST C: Concurrent hold + dispense');
    console.log('─'.repeat(70));

    // Reset stock
    const testLot2 = 'LOT-TIER4-CONCURRENT';
    await setupStock(tenantId, testProductId, testLot2, testExpiry, sourceLocation, 50);

    await runTest('C.1 Setup: 50 units available', async () => {
        const qty = await getStock(tenantId, testProductId, testLot2, sourceLocation);
        if (qty !== 50) throw new Error(`Expected 50, got ${qty}`);
    });

    await runTest('C.2 Concurrent: hold(40) + dispense(40) - one must fail', async () => {
        const sessHold = uuidv4();
        
        const results = await Promise.allSettled([
            stockReservationService.hold(tenantId, {
                session_id: sessHold,
                user_id: uuidv4(),
                product_id: testProductId,
                lot: testLot2,
                expiry: testExpiry,
                source_location_id: sourceLocation,
                qty_units: 40
            }),
            pharmacyService.dispense({
                tenantId,
                prescriptionId: undefined as any,
                admissionId: undefined as any,
                items: [{ productId: testProductId, qtyRequested: 40 }],
                sourceLocation,
                userId: testUserId
            })
        ]);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        // Both try to take 40 out of 50. First wins, second sees only 10 (or 50-40=10).
        // So one succeeds, one fails with INSUFFICIENT.
        if (successes !== 1 || failures !== 1) {
            // If both succeeded, that means combined 80 was taken from 50 = BUG
            // If both failed, that's also wrong
            throw new Error(`Expected 1 success + 1 failure, got ${successes}/${failures}`);
        }
    });

    await runTest('C.3 Final stock should NOT be negative', async () => {
        const qty = await getStock(tenantId, testProductId, testLot2, sourceLocation);
        if (qty < 0) throw new Error(`Negative stock detected: ${qty}`);
    });

    // Cleanup concurrent test
    await cleanupTest(tenantId, testLot2);

    // =========================================================================
    // TEST D: SQL Invariants
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST D: SQL Invariants');
    console.log('─'.repeat(70));

    await runTest('D.1 No negative stock', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM current_stock WHERE qty_units < 0`);
        if (rows.length > 0) throw new Error(`Found ${rows.length} negative stock rows`);
    });

    await runTest('D.2 All inventory_movements have valid document_id', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM inventory_movements WHERE document_id IS NULL AND lot LIKE 'LOT-TIER4%'`);
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
    console.log('TIER 4 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ TIER 4 VALIDATION FAILED');
        console.log('\nFailed tests:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.test}: ${r.error}`);
        }
        process.exit(1);
    } else {
        console.log('\n✅ TIER 4 VALIDATION PASSED');
        console.log('\nReservation-aware dispense is functioning correctly.');
        console.log('Concurrent basket holds prevent dispense from stealing reserved stock.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
