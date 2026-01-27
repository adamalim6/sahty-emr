/**
 * API Smoke Test
 * 
 * Tests all critical API endpoints with actual HTTP calls.
 * Verifies PostgreSQL connectivity and service functionality.
 * 
 * Usage: npx ts-node scripts/test/api_smoke_test.ts <tenant_id>
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
    name: string;
    passed: boolean;
    status?: number;
    duration: number;
    error?: string;
}

const results: TestResult[] = [];

async function testRoute(
    name: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: any,
    expectedStatus: number = 200
): Promise<TestResult> {
    const start = Date.now();
    
    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': process.argv[2] || 'test-tenant'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const duration = Date.now() - start;
        const passed = response.status === expectedStatus || 
                       (expectedStatus === 200 && response.status < 300);

        return {
            name,
            passed,
            status: response.status,
            duration,
            error: passed ? undefined : `Expected ${expectedStatus}, got ${response.status}`
        };
    } catch (err: any) {
        return {
            name,
            passed: false,
            duration: Date.now() - start,
            error: err.message
        };
    }
}

async function runTests(tenantId: string) {
    console.log('='.repeat(60));
    console.log('API SMOKE TEST');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Tenant ID: ${tenantId}\n`);

    // A) Superadmin (Global)
    console.log('📦 A) SUPERADMIN MODULE');
    results.push(await testRoute('A1. Get Global Products', 'GET', '/api/superadmin/products'));
    
    // B) Paramétrage
    console.log('\n📦 B) PARAMÉTRAGE MODULE');
    results.push(await testRoute('B1. Get Services', 'GET', `/api/parametrage/services`));
    results.push(await testRoute('B2. Get Locations', 'GET', `/api/parametrage/locations`));
    results.push(await testRoute('B3. Get Users', 'GET', `/api/parametrage/users`));
    results.push(await testRoute('B4. Get Roles', 'GET', `/api/parametrage/roles`));

    // C) Tenant Catalog
    console.log('\n📦 C) TENANT CATALOG');
    results.push(await testRoute('C1. Get Activated Products', 'GET', `/api/catalog/products`));
    
    // D) Pharmacy
    console.log('\n📦 D) PHARMACY MODULE');
    results.push(await testRoute('D1. Get Current Stock', 'GET', `/api/pharmacy/stock`));
    results.push(await testRoute('D2. Get Movements', 'GET', `/api/pharmacy/movements`));
    results.push(await testRoute('D3. Get Locations', 'GET', `/api/pharmacy/locations`));

    // E) EMR
    console.log('\n📦 E) EMR MODULE');
    results.push(await testRoute('E1. Get Patients', 'GET', `/api/patients`));
    results.push(await testRoute('E2. Get Admissions', 'GET', `/api/admissions`));
    results.push(await testRoute('E3. Get Prescriptions', 'GET', `/api/prescriptions`));

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    let passed = 0, failed = 0;
    for (const result of results) {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.name} (${result.duration}ms)`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
        result.passed ? passed++ : failed++;
    }

    console.log('\n─'.repeat(60));
    console.log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.log('\n❌ Some tests failed. Review API connectivity and service implementation.');
        return 1;
    } else {
        console.log('\n✅ All smoke tests passed!');
        return 0;
    }
}

async function main() {
    const tenantId = process.argv[2] || 'test-tenant';
    const exitCode = await runTests(tenantId);
    process.exit(exitCode);
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
