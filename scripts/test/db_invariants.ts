/**
 * Database Invariants Test
 * 
 * Validates critical database invariants after PostgreSQL cutover:
 * - No negative stock
 * - Reserved <= On-hand
 * - Only one active price version per product
 * - No orphan references
 * 
 * Usage: npx ts-node scripts/test/db_invariants.ts <tenant_id>
 */

import { Pool } from 'pg';

interface InvariantResult {
    name: string;
    passed: boolean;
    count?: number;
    details?: string;
}

async function checkGlobalInvariants(): Promise<InvariantResult[]> {
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_global'
    });

    const results: InvariantResult[] = [];

    try {
        console.log('\n📊 GLOBAL DATABASE INVARIANTS');
        console.log('─'.repeat(50));

        // 1. No orphan users (client_id must exist)
        const orphanUsers = await pool.query(`
            SELECT COUNT(*) as count FROM users u
            LEFT JOIN clients c ON c.id = u.client_id
            WHERE u.client_id IS NOT NULL AND c.id IS NULL
        `);
        const orphanCount = parseInt(orphanUsers.rows[0].count);
        results.push({
            name: 'No orphan users (missing client)',
            passed: orphanCount === 0,
            count: orphanCount,
            details: orphanCount > 0 ? `${orphanCount} users reference non-existent clients` : undefined
        });

        // 2. All products have valid type
        const invalidTypes = await pool.query(`
            SELECT COUNT(*) as count FROM global_products 
            WHERE type NOT IN ('MEDICAMENT', 'CONSOMMABLE', 'DISPOSITIF_MEDICAL')
            AND is_active = TRUE
        `);
        const invalidCount = parseInt(invalidTypes.rows[0].count);
        results.push({
            name: 'All products have valid type',
            passed: invalidCount === 0,
            count: invalidCount,
            details: invalidCount > 0 ? `${invalidCount} products with invalid type` : undefined
        });

        // 3. Price history references valid products
        const orphanPrices = await pool.query(`
            SELECT COUNT(*) as count FROM global_product_price_history h
            LEFT JOIN global_products p ON p.id = h.product_id
            WHERE p.id IS NULL
        `);
        const orphanPriceCount = parseInt(orphanPrices.rows[0].count);
        results.push({
            name: 'Price history references valid products',
            passed: orphanPriceCount === 0,
            count: orphanPriceCount
        });

        for (const r of results) {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
            if (r.details) console.log(`   ${r.details}`);
        }

    } finally {
        await pool.end();
    }

    return results;
}

async function checkTenantInvariants(tenantId: string): Promise<InvariantResult[]> {
    const dbName = `sahty_tenant_${tenantId}`;
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName
    });

    const results: InvariantResult[] = [];

    try {
        console.log(`\n📊 TENANT ${tenantId} INVARIANTS`);
        console.log('─'.repeat(50));

        // 1. NO NEGATIVE STOCK
        const negStock = await pool.query(`
            SELECT COUNT(*) as count FROM current_stock WHERE qty_units < 0
        `);
        const negCount = parseInt(negStock.rows[0].count);
        results.push({
            name: 'No negative stock values',
            passed: negCount === 0,
            count: negCount,
            details: negCount > 0 ? `${negCount} rows with negative qty_units` : undefined
        });

        // 2. RESERVED <= ON-HAND
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
            name: 'Reserved <= On-hand',
            passed: overReserved.rows.length === 0,
            count: overReserved.rows.length,
            details: overReserved.rows.length > 0 ? `${overReserved.rows.length} over-reserved items` : undefined
        });

        // 3. ONLY ONE ACTIVE PRICE VERSION PER PRODUCT
        const multiActive = await pool.query(`
            SELECT product_id, COUNT(*) as count
            FROM product_price_versions 
            WHERE valid_to IS NULL 
            GROUP BY product_id 
            HAVING COUNT(*) > 1
        `);
        results.push({
            name: 'Only one active price version per product',
            passed: multiActive.rows.length === 0,
            count: multiActive.rows.length,
            details: multiActive.rows.length > 0 ? `${multiActive.rows.length} products with multiple active prices` : undefined
        });

        // 4. NO ORPHAN RESERVATIONS
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
            name: 'No orphan reservations',
            passed: orphanCount === 0,
            count: orphanCount,
            details: orphanCount > 0 ? `${orphanCount} reservations reference missing stock` : undefined
        });

        // 5. USERS HAVE VALID ROLES (if roles table has data)
        const orphanUserRoles = await pool.query(`
            SELECT COUNT(*) as count FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.role_id IS NOT NULL AND r.id IS NULL
        `);
        const orphanRoleCount = parseInt(orphanUserRoles.rows[0].count);
        results.push({
            name: 'Users have valid roles',
            passed: orphanRoleCount === 0,
            count: orphanRoleCount
        });

        // 6. ADMISSIONS REFERENCE VALID SERVICES
        const orphanAdmissions = await pool.query(`
            SELECT COUNT(*) as count FROM admissions a
            LEFT JOIN services s ON s.id = a.service_id
            WHERE s.id IS NULL
        `);
        const orphanAdmCount = parseInt(orphanAdmissions.rows[0].count);
        results.push({
            name: 'Admissions reference valid services',
            passed: orphanAdmCount === 0,
            count: orphanAdmCount
        });

        for (const r of results) {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
            if (r.details) console.log(`   ${r.details}`);
        }

    } finally {
        await pool.end();
    }

    return results;
}

async function main() {
    console.log('='.repeat(60));
    console.log('DATABASE INVARIANTS TEST');
    console.log('='.repeat(60));

    const tenantId = process.argv[2];

    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/test/db_invariants.ts <tenant_id>');
        process.exit(1);
    }

    const globalResults = await checkGlobalInvariants();
    const tenantResults = await checkTenantInvariants(tenantId);

    const allResults = [...globalResults, ...tenantResults];
    const failures = allResults.filter(r => !r.passed);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total checks: ${allResults.length}`);
    console.log(`Passed: ${allResults.length - failures.length}`);
    console.log(`Failed: ${failures.length}`);

    if (failures.length > 0) {
        console.log('\n❌ Invariant violations detected!');
        process.exit(1);
    } else {
        console.log('\n✅ All invariants satisfied!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
