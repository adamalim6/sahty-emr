/**
 * Migration Verification: Inventory Reconciliation
 * 
 * Validates inventory data integrity after migration:
 * - No negative stock values
 * - Reserved <= On-hand
 * - Movements sum = Current stock
 * 
 * Usage: npx ts-node scripts/verify/inventory_reconcile.ts <tenant_id>
 */

import { Pool } from 'pg';

interface ReconcileResult {
    check: string;
    passed: boolean;
    details?: string;
    count?: number;
}

async function reconcileTenant(tenantId: string): Promise<ReconcileResult[]> {
    const dbName = `tenant_${tenantId}`;
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName
    });
    
    const results: ReconcileResult[] = [];
    
    try {
        console.log(`\n📦 Reconciling tenant: ${tenantId}`);
        console.log('─'.repeat(50));
        
        // 1. Check for negative stock
        const negativeStock = await pool.query(`
            SELECT COUNT(*) as count FROM current_stock WHERE qty_units < 0
        `);
        const negCount = parseInt(negativeStock.rows[0].count);
        results.push({
            check: 'No negative stock values',
            passed: negCount === 0,
            count: negCount,
            details: negCount > 0 ? `Found ${negCount} rows with negative qty` : undefined
        });
        
        // 2. Check reserved vs on-hand
        const overReserved = await pool.query(`
            SELECT 
                cs.product_id, cs.lot, cs.location,
                cs.qty_units as on_hand,
                COALESCE(SUM(sr.qty_units), 0) as reserved
            FROM current_stock cs
            LEFT JOIN stock_reservations sr 
                ON sr.product_id = cs.product_id 
                AND sr.lot = cs.lot 
                AND sr.location_id = cs.location
                AND sr.status = 'ACTIVE'
            GROUP BY cs.product_id, cs.lot, cs.location, cs.qty_units
            HAVING COALESCE(SUM(sr.qty_units), 0) > cs.qty_units
        `);
        results.push({
            check: 'Reserved <= On-hand',
            passed: overReserved.rows.length === 0,
            count: overReserved.rows.length,
            details: overReserved.rows.length > 0 
                ? `${overReserved.rows.length} items over-reserved` 
                : undefined
        });
        
        // 3. Check movement sum vs current stock (sampled)
        const movementCheck = await pool.query(`
            WITH movement_totals AS (
                SELECT 
                    product_id, lot, 
                    COALESCE(to_location, 'OUT') as location,
                    SUM(CASE WHEN to_location IS NOT NULL THEN qty_units ELSE 0 END) as total_in,
                    SUM(CASE WHEN from_location IS NOT NULL THEN qty_units ELSE 0 END) as total_out
                FROM inventory_movements
                GROUP BY product_id, lot, COALESCE(to_location, 'OUT')
            )
            SELECT 
                cs.product_id, cs.lot, cs.location, cs.qty_units as current,
                COALESCE(mt.total_in, 0) - COALESCE(mt.total_out, 0) as calculated
            FROM current_stock cs
            LEFT JOIN movement_totals mt 
                ON mt.product_id = cs.product_id 
                AND mt.lot = cs.lot 
                AND mt.location = cs.location
            WHERE cs.qty_units != COALESCE(mt.total_in, 0) - COALESCE(mt.total_out, 0)
            LIMIT 10
        `);
        results.push({
            check: 'Movements sum = Current stock',
            passed: movementCheck.rows.length === 0,
            count: movementCheck.rows.length,
            details: movementCheck.rows.length > 0 
                ? `${movementCheck.rows.length}+ discrepancies found` 
                : undefined
        });
        
        // 4. Check for orphan reservations
        const orphanRes = await pool.query(`
            SELECT COUNT(*) as count 
            FROM stock_reservations sr
            LEFT JOIN current_stock cs 
                ON cs.product_id = sr.product_id 
                AND cs.lot = sr.lot 
                AND cs.location = sr.location_id
            WHERE sr.status = 'ACTIVE' AND cs.product_id IS NULL
        `);
        const orphanCount = parseInt(orphanRes.rows[0].count);
        results.push({
            check: 'No orphan reservations',
            passed: orphanCount === 0,
            count: orphanCount,
            details: orphanCount > 0 
                ? `${orphanCount} reservations reference missing stock` 
                : undefined
        });
        
        // 5. Check expired stock (warning only)
        const expiredStock = await pool.query(`
            SELECT COUNT(*) as count 
            FROM current_stock 
            WHERE expiry < CURRENT_DATE AND qty_units > 0
        `);
        const expiredCount = parseInt(expiredStock.rows[0].count);
        results.push({
            check: 'No expired stock (warning)',
            passed: true, // Warning only
            count: expiredCount,
            details: expiredCount > 0 ? `⚠️ ${expiredCount} lots expired` : undefined
        });
        
        // Print results
        for (const r of results) {
            const status = r.passed ? '✅' : '❌';
            console.log(`${status} ${r.check}`);
            if (r.details) {
                console.log(`   ${r.details}`);
            }
        }
        
    } finally {
        await pool.end();
    }
    
    return results;
}

async function main() {
    console.log('='.repeat(60));
    console.log('INVENTORY RECONCILIATION');
    console.log('='.repeat(60));
    
    const tenantId = process.argv[2];
    
    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/verify/inventory_reconcile.ts <tenant_id>');
        process.exit(1);
    }
    
    const results = await reconcileTenant(tenantId);
    
    const failures = results.filter(r => !r.passed);
    
    console.log('\n' + '='.repeat(60));
    if (failures.length === 0) {
        console.log('✅ All reconciliation checks passed!');
        return 0;
    } else {
        console.log(`❌ ${failures.length} check(s) failed`);
        return 1;
    }
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Reconciliation failed:', err);
        process.exit(1);
    });
