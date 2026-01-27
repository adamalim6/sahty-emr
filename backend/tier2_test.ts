/**
 * TIER 2 VALIDATION: Reservation Engine Tests
 * 
 * Tests:
 * A) hold() - reserves stock without modifying current_stock
 * B) releaseSession() - cancels reservations idempotently
 * C) commitSession() - atomic posting with guarded decrements
 * D) Concurrency - two sessions can't over-reserve same lot
 * E) Invariants - no negative stock, reserved <= onhand
 * 
 * Run from backend/: npx ts-node --transpile-only tier2_test.ts demo_tenant
 */

import { v4 as uuidv4 } from 'uuid';
import { tenantQuery, tenantTransaction, getTenantPool } from './db/tenantPg';
import { stockReservationService, HoldRequest } from './services/stockReservationService';
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

async function setupTestStock(tenantId: string, productId: string, lot: string, location: string, qty: number) {
    await tenantQuery(tenantId, `
        INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
        VALUES ($1, $2, $3, '2027-12-31', $4, $5)
        ON CONFLICT(tenant_id, product_id, lot, location) 
        DO UPDATE SET qty_units = $5
    `, [tenantId, productId, lot, location, qty]);
}

async function getStockQty(tenantId: string, productId: string, lot: string, location: string): Promise<number> {
    const rows = await tenantQuery(tenantId, `
        SELECT qty_units FROM current_stock 
        WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = $4
    `, [tenantId, productId, lot, location]);
    return rows.length > 0 ? rows[0].qty_units : 0;
}

async function cleanupTest(tenantId: string, lot: string, sessionPrefix: string) {
    await tenantQuery(tenantId, `DELETE FROM stock_reservations WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM inventory_movements WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM stock_transfer_lines WHERE lot = $1`, [lot]);
    await tenantQuery(tenantId, `DELETE FROM stock_transfers WHERE id::text LIKE $1`, [`trf_%`]);
    await tenantQuery(tenantId, `DELETE FROM current_stock WHERE lot = $1`, [lot]);
}

async function main() {
    const tenantId = process.argv[2] || 'demo_tenant';
    const testProductId = uuidv4();  // Use proper UUID
    const testLot = 'LOT-TIER2-TEST';
    const testLocation = `PHARMACY-${uuidv4().slice(0,8)}`;  // TEXT location field
    const testDestLocation = `NEURO-${uuidv4().slice(0,8)}`;  // TEXT location field

    console.log('='.repeat(70));
    console.log('TIER 2 VALIDATION: Reservation Engine');
    console.log('='.repeat(70));
    console.log(`Tenant: ${tenantId}\n`);

    // Cleanup before tests
    await cleanupTest(tenantId, testLot, 'sess_');

    // Setup: Create test service first
    const testServiceId = uuidv4();
    await tenantQuery(tenantId, `
        INSERT INTO services (id, tenant_id, code, name)
        VALUES ($1, $2, 'NEURO', 'Neurology')
        ON CONFLICT (id) DO NOTHING
    `, [testServiceId, tenantId]);

    // Setup: Create test demand (required for commitSession)
    const demandId = uuidv4();
    await tenantQuery(tenantId, `
        INSERT INTO stock_demands (id, tenant_id, service_id, status, requested_by, created_at)
        VALUES ($1, $2, $3, 'SUBMITTED', 'test_user', NOW())
        ON CONFLICT (id) DO NOTHING
    `, [demandId, tenantId, testServiceId]);

    // Setup: Create location for destination (location_id is now UUID)
    const destLocationId = uuidv4();
    await tenantQuery(tenantId, `
        INSERT INTO locations (location_id, tenant_id, name, type, scope, service_id, status)
        VALUES ($1, $2, 'Neuro Unit 1', 'WARD', 'SERVICE', $3, 'ACTIVE')
        ON CONFLICT (location_id) DO NOTHING
    `, [destLocationId, tenantId, testServiceId]);

    // =========================================================================
    // TEST A: hold() - Basic Functionality
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST A: hold() - Basic Functionality');
    console.log('─'.repeat(70));

    await runTest('A.1 Setup: Create 100 units of test stock', async () => {
        await setupTestStock(tenantId, testProductId, testLot, testLocation, 100);
        const qty = await getStockQty(tenantId, testProductId, testLot, testLocation);
        if (qty !== 100) throw new Error(`Expected 100, got ${qty}`);
    });

    const sessionId1 = `sess_${uuidv4()}`;

    await runTest('A.2 hold() 30 units - should succeed', async () => {
        const reservation = await stockReservationService.hold(tenantId, {
            session_id: sessionId1,
            user_id: 'test_user',
            demand_id: demandId,
            product_id: testProductId,
            lot: testLot,
            expiry: '2027-12-31',
            location_id: testLocation,
            destination_location_id: testDestLocation,
            qty_units: 30
        });
        if (reservation.qty_units !== 30) throw new Error(`Expected 30 reserved, got ${reservation.qty_units}`);
    });

    await runTest('A.3 current_stock unchanged after hold (still 100)', async () => {
        const qty = await getStockQty(tenantId, testProductId, testLot, testLocation);
        if (qty !== 100) throw new Error(`Expected 100 (unchanged), got ${qty}`);
    });

    await runTest('A.4 hold() 60 more units - should succeed (available = 100 - 30 = 70)', async () => {
        await stockReservationService.hold(tenantId, {
            session_id: sessionId1,
            user_id: 'test_user',
            demand_id: demandId,
            product_id: testProductId,
            lot: testLot,
            expiry: '2027-12-31',
            location_id: testLocation,
            qty_units: 60
        });
    });

    await runTest('A.5 hold() 20 more - should FAIL (available = 100 - 90 = 10)', async () => {
        try {
            await stockReservationService.hold(tenantId, {
                session_id: sessionId1,
                user_id: 'test_user',
                demand_id: demandId,
                product_id: testProductId,
                lot: testLot,
                expiry: '2027-12-31',
                location_id: testLocation,
                qty_units: 20
            });
            throw new Error('Should have thrown INSUFFICIENT_AVAILABLE_STOCK');
        } catch (err: any) {
            if (!err.message.includes('INSUFFICIENT_AVAILABLE_STOCK')) throw err;
        }
    });

    // =========================================================================
    // TEST B: releaseSession() - Idempotent Release
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST B: releaseSession() - Idempotent Release');
    console.log('─'.repeat(70));

    await runTest('B.1 releaseSession() - should release all active reservations', async () => {
        await stockReservationService.releaseSession(tenantId, sessionId1);
    });

    await runTest('B.2 current_stock still 100 after release', async () => {
        const qty = await getStockQty(tenantId, testProductId, testLot, testLocation);
        if (qty !== 100) throw new Error(`Expected 100, got ${qty}`);
    });

    await runTest('B.3 releaseSession() again - idempotent', async () => {
        await stockReservationService.releaseSession(tenantId, sessionId1);
        // Should not throw
    });

    await runTest('B.4 Can now reserve all 100 units (reservations released)', async () => {
        const sessionId2 = `sess_${uuidv4()}`;
        await stockReservationService.hold(tenantId, {
            session_id: sessionId2,
            user_id: 'test_user',
            product_id: testProductId,
            lot: testLot,
            expiry: '2027-12-31',
            location_id: testLocation,
            qty_units: 100
        });
        // Release for next tests
        await stockReservationService.releaseSession(tenantId, sessionId2);
    });

    // =========================================================================
    // TEST C: commitSession() - Atomic Posting
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST C: commitSession() - Atomic Posting');
    console.log('─'.repeat(70));

    const sessionIdCommit = `sess_commit_${uuidv4()}`;

    await runTest('C.1 Setup: hold 50 units for commit test', async () => {
        await stockReservationService.hold(tenantId, {
            session_id: sessionIdCommit,
            user_id: 'test_user',
            demand_id: demandId,
            product_id: testProductId,
            lot: testLot,
            expiry: '2027-12-31',
            location_id: testLocation,
            destination_location_id: testDestLocation,
            qty_units: 50
        });
    });

    let transferId: string | null = null;

    await runTest('C.2 commitSession() - posts reservation to reality', async () => {
        transferId = await stockReservationService.commitSession(
            tenantId, sessionIdCommit, demandId, 'test_user'
        );
        if (!transferId) throw new Error('Expected transferId');
    });

    await runTest('C.3 Source stock decremented (100 - 50 = 50)', async () => {
        const qty = await getStockQty(tenantId, testProductId, testLot, testLocation);
        if (qty !== 50) throw new Error(`Expected 50, got ${qty}`);
    });

    await runTest('C.4 Destination stock created (50 units)', async () => {
        const qty = await getStockQty(tenantId, testProductId, testLot, testDestLocation);
        if (qty !== 50) throw new Error(`Expected 50, got ${qty}`);
    });

    await runTest('C.5 stock_transfers record created', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM stock_transfers WHERE id = $1`, [transferId]);
        if (rows.length !== 1) throw new Error('Transfer not found');
        if (rows[0].status !== 'VALIDATED') throw new Error(`Expected VALIDATED, got ${rows[0].status}`);
    });

    await runTest('C.6 inventory_movements record created', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM inventory_movements WHERE document_id = $1`, [transferId]);
        if (rows.length !== 1) throw new Error(`Expected 1 movement, got ${rows.length}`);
        if (rows[0].qty_units !== 50) throw new Error(`Expected 50 units in movement`);
    });

    await runTest('C.7 Reservation marked COMMITTED', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM stock_reservations WHERE session_id = $1 AND status = 'COMMITTED'`, 
            [sessionIdCommit]);
        if (rows.length !== 1) throw new Error(`Expected 1 committed reservation`);
    });

    // =========================================================================
    // TEST D: Concurrency - Two sessions cannot over-reserve
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST D: Concurrency - Two sessions cannot over-reserve');
    console.log('─'.repeat(70));

    // Reset stock to 30
    await setupTestStock(tenantId, testProductId, testLot, testLocation, 30);

    await runTest('D.1 Setup: Stock is 30 units', async () => {
        const qty = await getStockQty(tenantId, testProductId, testLot, testLocation);
        if (qty !== 30) throw new Error(`Expected 30, got ${qty}`);
    });

    await runTest('D.2 Concurrent holds: 2 sessions try to hold 20 each (only 30 available)', async () => {
        const sessA = `sess_concurrent_A_${uuidv4()}`;
        const sessB = `sess_concurrent_B_${uuidv4()}`;

        const results = await Promise.allSettled([
            stockReservationService.hold(tenantId, {
                session_id: sessA,
                user_id: 'user_a',
                product_id: testProductId,
                lot: testLot,
                expiry: '2027-12-31',
                location_id: testLocation,
                qty_units: 20
            }),
            stockReservationService.hold(tenantId, {
                session_id: sessB,
                user_id: 'user_b',
                product_id: testProductId,
                lot: testLot,
                expiry: '2027-12-31',
                location_id: testLocation,
                qty_units: 20
            })
        ]);

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        // One should succeed (20 <= 30), one should fail (20 > 30 - 20 = 10)
        if (successes !== 1 || failures !== 1) {
            throw new Error(`Expected 1 success + 1 failure, got ${successes}/${failures}`);
        }
    });

    // =========================================================================
    // TEST E: SQL Invariants
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST E: SQL Invariants');
    console.log('─'.repeat(70));

    await runTest('E.1 No negative stock', async () => {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM current_stock WHERE qty_units < 0`);
        if (rows.length > 0) throw new Error(`Found ${rows.length} negative stock rows`);
    });

    await runTest('E.2 Reserved <= OnHand per lot', async () => {
        const violations = await tenantQuery(tenantId, `
            SELECT 
                cs.location, cs.product_id, cs.lot, cs.qty_units as onhand,
                COALESCE(SUM(sr.qty_units), 0) as reserved
            FROM current_stock cs
            LEFT JOIN stock_reservations sr ON 
                sr.tenant_id = cs.tenant_id AND
                sr.location_id = cs.location AND
                sr.product_id = cs.product_id AND
                sr.lot = cs.lot AND
                sr.status = 'ACTIVE' AND
                sr.expires_at > NOW()
            WHERE cs.tenant_id = $1
            GROUP BY cs.location, cs.product_id, cs.lot, cs.qty_units
            HAVING COALESCE(SUM(sr.qty_units), 0) > cs.qty_units
        `, [tenantId]);
        if (violations.length > 0) {
            throw new Error(`Found ${violations.length} lots where reserved > onhand`);
        }
    });

    await runTest('E.3 Committed transfers have matching inventory_movements', async () => {
        const orphans = await tenantQuery(tenantId, `
            SELECT st.id 
            FROM stock_transfers st
            LEFT JOIN inventory_movements im ON im.document_id = st.id::text
            WHERE st.tenant_id = $1 AND st.status = 'VALIDATED' AND im.movement_id IS NULL
        `, [tenantId]);
        if (orphans.length > 0) {
            throw new Error(`Found ${orphans.length} transfers without movements`);
        }
    });

    // =========================================================================
    // CLEANUP & SUMMARY
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('CLEANUP');
    console.log('─'.repeat(70));
    
    // Delete in proper FK order: stock_transfers references stock_demands
    await tenantQuery(tenantId, `DELETE FROM stock_transfers WHERE demand_id = $1`, [demandId]);
    await cleanupTest(tenantId, testLot, 'sess_');
    await tenantQuery(tenantId, `DELETE FROM stock_demands WHERE id = $1`, [demandId]);
    console.log('   Test data cleaned up\n');

    // Summary
    console.log('='.repeat(70));
    console.log('TIER 2 VALIDATION SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ TIER 2 VALIDATION FAILED');
        console.log('\nFailed tests:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.test}: ${r.error}`);
        }
        console.log('\n⚠️ DO NOT PROCEED TO TIER 3.');
        process.exit(1);
    } else {
        console.log('\n✅ TIER 2 VALIDATION PASSED');
        console.log('\nReservation Engine is functioning correctly.');
        console.log('Ready to proceed to TIER 3: Stock Movements (transfer()).');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
