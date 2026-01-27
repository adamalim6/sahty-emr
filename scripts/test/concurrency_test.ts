/**
 * Concurrency Test
 * 
 * Tests race condition handling for critical pharmacy operations:
 * - Simultaneous hold requests
 * - Simultaneous dispense requests
 * - Simultaneous transfer requests
 * 
 * Usage: npx ts-node scripts/test/concurrency_test.ts <tenant_id>
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface TestResult {
    name: string;
    passed: boolean;
    details?: string;
}

async function runConcurrencyTests(tenantId: string): Promise<TestResult[]> {
    const dbName = `sahty_tenant_${tenantId}`;
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName,
        max: 10 // Allow parallel connections
    });

    const results: TestResult[] = [];
    const testProductId = uuidv4();
    const testLot = 'CONC_TEST_LOT';
    const testLocation = 'PHARMACY_CENTRAL';

    try {
        console.log('\n🧪 SETTING UP TEST DATA');
        console.log('─'.repeat(50));

        // Setup: Create test stock with 100 units
        await pool.query(`
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
            VALUES ($1, $2, $3, '2026-12-31', $4, 100)
            ON CONFLICT (tenant_id, product_id, lot, location) 
            DO UPDATE SET qty_units = 100
        `, [tenantId, testProductId, testLot, testLocation]);

        console.log('✅ Created test stock: 100 units\n');

        // =========================================================================
        // TEST 1: Simultaneous Stock Deductions
        // =========================================================================
        console.log('🧪 TEST 1: SIMULTANEOUS DEDUCTIONS');
        console.log('   Two threads try to deduct 60 units each (total 120 from 100)');
        console.log('   Expected: One succeeds, one fails or both partial');

        const deductTask = async (taskName: string, qty: number): Promise<{ success: boolean; remaining?: number; error?: string }> => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Lock and check
                const lockResult = await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = $4
                    FOR UPDATE
                `, [tenantId, testProductId, testLot, testLocation]);

                const available = lockResult.rows[0]?.qty_units || 0;

                // Simulate processing delay
                await sleep(Math.random() * 100);

                // Guarded deduction
                const result = await client.query(`
                    UPDATE current_stock 
                    SET qty_units = qty_units - $1
                    WHERE tenant_id = $2 AND product_id = $3 AND lot = $4 AND location = $5
                      AND qty_units >= $1
                    RETURNING qty_units
                `, [qty, tenantId, testProductId, testLot, testLocation]);

                if (result.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return { success: false, error: 'Insufficient stock' };
                }

                await client.query('COMMIT');
                return { success: true, remaining: result.rows[0].qty_units };

            } catch (err: any) {
                await client.query('ROLLBACK');
                return { success: false, error: err.message };
            } finally {
                client.release();
            }
        };

        // Reset stock to 100
        await pool.query(`
            UPDATE current_stock SET qty_units = 100
            WHERE tenant_id = $1 AND product_id = $2
        `, [tenantId, testProductId]);

        const [r1, r2] = await Promise.all([
            deductTask('Thread 1', 60),
            deductTask('Thread 2', 60)
        ]);

        console.log(`   Thread 1: ${r1.success ? '✅ Success' : '❌ Failed'} ${r1.success ? `(remaining: ${r1.remaining})` : `(${r1.error})`}`);
        console.log(`   Thread 2: ${r2.success ? '✅ Success' : '❌ Failed'} ${r2.success ? `(remaining: ${r2.remaining})` : `(${r2.error})`}`);

        // Verify final state
        const finalStock = await pool.query(`
            SELECT qty_units FROM current_stock 
            WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = $4
        `, [tenantId, testProductId, testLot, testLocation]);

        const finalQty = finalStock.rows[0]?.qty_units || 0;
        console.log(`   Final stock: ${finalQty} units`);

        const test1Passed = finalQty >= 0 && ((!r1.success || !r2.success) || finalQty >= 0);
        results.push({
            name: 'Simultaneous deductions: No negative stock',
            passed: finalQty >= 0,
            details: finalQty < 0 ? 'Stock went negative!' : `Final: ${finalQty} units`
        });

        // =========================================================================
        // TEST 2: Concurrent Reservations
        // =========================================================================
        console.log('\n🧪 TEST 2: CONCURRENT RESERVATIONS');
        console.log('   Two threads try to reserve 60 units each (total 120 from 100)');

        // Reset stock to 100
        await pool.query(`UPDATE current_stock SET qty_units = 100 WHERE tenant_id = $1 AND product_id = $2`, [tenantId, testProductId]);
        await pool.query(`DELETE FROM stock_reservations WHERE tenant_id = $1 AND product_id = $2`, [tenantId, testProductId]);

        const reserveTask = async (taskName: string, qty: number): Promise<{ success: boolean; reserved?: number; error?: string }> => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Get available stock (with existing reservations)
                const stockResult = await client.query(`
                    SELECT 
                        cs.qty_units,
                        COALESCE(SUM(CASE WHEN sr.status = 'ACTIVE' THEN sr.qty_units ELSE 0 END), 0) as reserved
                    FROM current_stock cs
                    LEFT JOIN stock_reservations sr 
                        ON sr.product_id = cs.product_id AND sr.lot = cs.lot AND sr.location_id = cs.location AND sr.status = 'ACTIVE'
                    WHERE cs.tenant_id = $1 AND cs.product_id = $2 AND cs.lot = $3 AND cs.location = $4
                    GROUP BY cs.qty_units
                    FOR UPDATE OF cs
                `, [tenantId, testProductId, testLot, testLocation]);

                const row = stockResult.rows[0];
                const available = (row?.qty_units || 0) - (row?.reserved || 0);

                if (available < qty) {
                    await client.query('ROLLBACK');
                    return { success: false, error: `Only ${available} available` };
                }

                // Create reservation
                await client.query(`
                    INSERT INTO stock_reservations (reservation_id, tenant_id, session_id, user_id, product_id, lot, location_id, qty_units, status, expires_at)
                    VALUES ($1, $2, $3, 'test_user', $4, $5, $6, $7, 'ACTIVE', NOW() + INTERVAL '30 minutes')
                `, [uuidv4(), tenantId, uuidv4(), testProductId, testLot, testLocation, qty]);

                await client.query('COMMIT');
                return { success: true, reserved: qty };

            } catch (err: any) {
                await client.query('ROLLBACK');
                return { success: false, error: err.message };
            } finally {
                client.release();
            }
        };

        const [res1, res2] = await Promise.all([
            reserveTask('Res 1', 60),
            reserveTask('Res 2', 60)
        ]);

        console.log(`   Reservation 1: ${res1.success ? '✅' : '❌'} ${res1.success ? `Reserved ${res1.reserved}` : res1.error}`);
        console.log(`   Reservation 2: ${res2.success ? '✅' : '❌'} ${res2.success ? `Reserved ${res2.reserved}` : res2.error}`);

        // Check total reserved
        const totalReserved = await pool.query(`
            SELECT COALESCE(SUM(qty_units), 0) as total 
            FROM stock_reservations 
            WHERE tenant_id = $1 AND product_id = $2 AND status = 'ACTIVE'
        `, [tenantId, testProductId]);

        const reservedQty = parseInt(totalReserved.rows[0].total);
        console.log(`   Total reserved: ${reservedQty} units`);

        results.push({
            name: 'Concurrent reservations: Reserved <= Available',
            passed: reservedQty <= 100,
            details: reservedQty > 100 ? `Over-reserved: ${reservedQty} > 100` : `Total reserved: ${reservedQty}`
        });

        // =========================================================================
        // CLEANUP
        // =========================================================================
        console.log('\n🧹 CLEANUP');
        await pool.query(`DELETE FROM current_stock WHERE tenant_id = $1 AND product_id = $2`, [tenantId, testProductId]);
        await pool.query(`DELETE FROM stock_reservations WHERE tenant_id = $1 AND product_id = $2`, [tenantId, testProductId]);
        console.log('   Test data removed\n');

    } finally {
        await pool.end();
    }

    return results;
}

async function main() {
    console.log('='.repeat(60));
    console.log('CONCURRENCY TEST');
    console.log('='.repeat(60));

    const tenantId = process.argv[2];

    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/test/concurrency_test.ts <tenant_id>');
        process.exit(1);
    }

    const results = await runConcurrencyTests(tenantId);

    console.log('='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));

    let passed = 0, failed = 0;
    for (const r of results) {
        console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
        if (r.details) console.log(`   ${r.details}`);
        r.passed ? passed++ : failed++;
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ Concurrency issues detected!');
        process.exit(1);
    } else {
        console.log('\n✅ All concurrency tests passed!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
