/**
 * Concurrency Simulation Test
 * 
 * Tests the concurrency safety of the hold/commit workflow
 * by simulating parallel operations.
 * 
 * Usage: npx ts-node scripts/verify/concurrency_sim.ts <tenant_id>
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runConcurrencySim(tenantId: string): Promise<void> {
    const dbName = `tenant_${tenantId}`;
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName
    });
    
    try {
        console.log('='.repeat(60));
        console.log('CONCURRENCY SIMULATION TEST');
        console.log('='.repeat(60));
        console.log(`Database: ${dbName}\n`);
        
        // Setup: Create test product and stock
        const testProductId = uuidv4();
        const testLot = 'TEST_LOT_001';
        const testLocation = 'PHARMACY_CENTRAL';
        const initialQty = 100;
        
        console.log('📦 Setup: Creating test stock...');
        await pool.query(`
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tenant_id, product_id, lot, location) 
            DO UPDATE SET qty_units = $6
        `, [tenantId, testProductId, testLot, '2026-12-31', testLocation, initialQty]);
        
        console.log(`   Created: ${initialQty} units of test product\n`);
        
        // Test 1: Parallel deductions
        console.log('🧪 Test 1: Parallel Deductions (50 + 60 from 100 units)');
        console.log('   Expected: One succeeds, one fails or gets reduced amount\n');
        
        const deduct1 = async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Lock row
                await client.query(`
                    SELECT * FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND location = $3
                    FOR UPDATE
                `, [tenantId, testProductId, testLocation]);
                
                // Simulate processing time
                await sleep(100);
                
                // Guarded deduction
                const result = await client.query(`
                    UPDATE current_stock 
                    SET qty_units = qty_units - 50
                    WHERE tenant_id = $1 AND product_id = $2 AND location = $3
                      AND qty_units >= 50
                    RETURNING qty_units
                `, [tenantId, testProductId, testLocation]);
                
                if (result.rowCount === 0) {
                    throw new Error('Insufficient stock');
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
        
        const deduct2 = async () => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                await client.query(`
                    SELECT * FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND location = $3
                    FOR UPDATE
                `, [tenantId, testProductId, testLocation]);
                
                await sleep(50); // Slightly faster
                
                const result = await client.query(`
                    UPDATE current_stock 
                    SET qty_units = qty_units - 60
                    WHERE tenant_id = $1 AND product_id = $2 AND location = $3
                      AND qty_units >= 60
                    RETURNING qty_units
                `, [tenantId, testProductId, testLocation]);
                
                if (result.rowCount === 0) {
                    throw new Error('Insufficient stock');
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
        
        // Run in parallel
        const [result1, result2] = await Promise.all([deduct1(), deduct2()]);
        
        console.log(`   Deduction 1 (50 units): ${result1.success ? '✅ Success' : '❌ Failed'} ${result1.success ? `(remaining: ${result1.remaining})` : `(${result1.error})`}`);
        console.log(`   Deduction 2 (60 units): ${result2.success ? '✅ Success' : '❌ Failed'} ${result2.success ? `(remaining: ${result2.remaining})` : `(${result2.error})`}`);
        
        // Verify final state
        const finalStock = await pool.query(`
            SELECT qty_units FROM current_stock 
            WHERE tenant_id = $1 AND product_id = $2 AND location = $3
        `, [tenantId, testProductId, testLocation]);
        
        const finalQty = finalStock.rows[0]?.qty_units || 0;
        console.log(`   Final stock: ${finalQty} units`);
        
        // Validate: Should never go negative
        if (finalQty < 0) {
            console.log('   ❌ FAILURE: Stock went negative!');
        } else if (finalQty === 50 || finalQty === 40) {
            console.log('   ✅ PASS: Concurrency handled correctly');
        } else {
            console.log(`   ⚠️ UNEXPECTED: Final qty = ${finalQty}`);
        }
        
        // Cleanup
        console.log('\n🧹 Cleanup: Removing test data...');
        await pool.query(`
            DELETE FROM current_stock 
            WHERE tenant_id = $1 AND product_id = $2
        `, [tenantId, testProductId]);
        
        console.log('   Done\n');
        
    } finally {
        await pool.end();
    }
}

async function main() {
    const tenantId = process.argv[2];
    
    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/verify/concurrency_sim.ts <tenant_id>');
        process.exit(1);
    }
    
    await runConcurrencySim(tenantId);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Simulation failed:', err);
        process.exit(1);
    });
