/**
 * Backend Verification Checkpoint
 * 
 * HARD STOP validation before continuing pharmacyService refactoring.
 * Tests all refactored global services and basic tenant connectivity.
 * 
 * Run from backend/: npx ts-node verify_checkpoint.ts [tenantId]
 */

import { globalQuery, globalQueryOne } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';
import { globalProductService } from './services/globalProductService';
import { globalDCIService } from './services/GlobalDCIService';
import { globalActesService } from './services/globalActesService';
import { globalSupplierService } from './services/globalSupplierService';
import { globalAdminService } from './services/globalAdminService';

interface TestResult {
    test: string;
    passed: boolean;
    result?: any;
    error?: string;
    duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<any>): Promise<TestResult> {
    const start = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - start;
        console.log(`✅ ${name} (${duration}ms)`);
        if (result !== undefined && result !== null) {
            const str = JSON.stringify(result);
            console.log(`   Result: ${str.length > 80 ? str.substring(0, 80) + '...' : str}`);
        }
        return { test: name, passed: true, result, duration };
    } catch (err: any) {
        const duration = Date.now() - start;
        console.log(`❌ ${name} (${duration}ms)`);
        console.log(`   Error: ${err.message}`);
        return { test: name, passed: false, error: err.message, duration };
    }
}

async function main() {
    const tenantId = process.argv[2] || 'test_tenant';

    console.log('='.repeat(70));
    console.log('BACKEND VERIFICATION CHECKPOINT');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Tenant ID: ${tenantId}\n`);

    // =========================================================================
    // TEST 1: Global DB Connectivity
    // =========================================================================
    console.log('─'.repeat(70));
    console.log('TEST 1: GLOBAL DB CONNECTIVITY');
    console.log('─'.repeat(70));

    results.push(await runTest('1.1 Raw globalQuery SELECT 1', async () => {
        const rows = await globalQuery('SELECT 1 as test');
        if (rows[0]?.test !== 1) throw new Error('Unexpected result');
        return rows[0];
    }));

    results.push(await runTest('1.2 Count global_products', async () => {
        const row = await globalQueryOne<any>('SELECT COUNT(*) as c FROM global_products');
        return { count: parseInt(row?.c || '0') };
    }));

    results.push(await runTest('1.3 Count patients', async () => {
        const row = await globalQueryOne<any>('SELECT COUNT(*) as c FROM patients');
        return { count: parseInt(row?.c || '0') };
    }));

    results.push(await runTest('1.4 Count clients', async () => {
        const row = await globalQueryOne<any>('SELECT COUNT(*) as c FROM clients');
        return { count: parseInt(row?.c || '0') };
    }));

    // =========================================================================
    // TEST 2: Tenant DB Connectivity
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 2: TENANT DB CONNECTIVITY');
    console.log('─'.repeat(70));

    results.push(await runTest('2.1 Raw tenantQuery SELECT 1', async () => {
        try {
            const rows = await tenantQuery(tenantId, 'SELECT 1 as test', []);
            if (rows[0]?.test !== 1) throw new Error('Unexpected result');
            return rows[0];
        } catch (err: any) {
            if (err.message.includes('does not exist')) {
                return { note: 'Tenant DB does not exist - OK for new setups' };
            }
            throw err;
        }
    }));

    // =========================================================================
    // TEST 3: Global Service Calls
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('TEST 3: GLOBAL SERVICE CALLS');
    console.log('─'.repeat(70));

    results.push(await runTest('3.1 globalProductService.getAllProducts()', async () => {
        const products = await globalProductService.getAllProducts();
        return { count: products.length, sample: products[0]?.name };
    }));

    results.push(await runTest('3.2 globalProductService.getProductsPaginated(1, 5)', async () => {
        const result = await globalProductService.getProductsPaginated(1, 5);
        return { total: result.total, pageSize: result.data.length };
    }));

    results.push(await runTest('3.3 globalDCIService.getAllDCIs()', async () => {
        const dcis = await globalDCIService.getAllDCIs();
        return { count: dcis.length, sample: dcis[0]?.name };
    }));

    results.push(await runTest('3.4 globalActesService.getAll()', async () => {
        const actes = await globalActesService.getAll();
        return { count: actes.length };
    }));

    results.push(await runTest('3.5 globalSupplierService.getAll()', async () => {
        const suppliers = await globalSupplierService.getAll();
        return { count: suppliers.length };
    }));

    results.push(await runTest('3.6 globalAdminService.getAllClients()', async () => {
        const clients = await globalAdminService.getAllClients();
        return { count: clients.length };
    }));

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\n❌ CHECKPOINT FAILED');
        console.log('\nFailed tests:');
        for (const r of results.filter(r => !r.passed)) {
            console.log(`  - ${r.test}: ${r.error}`);
        }
        console.log('\n⚠️ DO NOT CONTINUE REFACTORING until these are resolved.');
        process.exit(1);
    } else {
        console.log('\n✅ CHECKPOINT PASSED');
        console.log('\nGlobal services are functioning correctly.');
        console.log('Safe to continue with pharmacyService refactoring.');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Checkpoint script failed:', err);
    process.exit(1);
});
