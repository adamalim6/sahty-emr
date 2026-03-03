const http = require('http');

const JWT_SECRET = 'dev_secret_2026'; // Default from authService.ts for dev
const jwt = require('jsonwebtoken');

const tenantToken = jwt.sign({ userId: 'some-user', realm: 'tenant', tenantId: 'demohospital' }, JWT_SECRET);
const globalToken = jwt.sign({ userId: 'admin-user', realm: 'global', role: 'SUPER_ADMIN' }, JWT_SECRET);

const makeRequest = (method, path, token, label) => {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[${label}] ${method} ${path} -> ${res.statusCode} ${res.statusMessage}`);
                console.log(`Response: ${data}\n`);
                resolve();
            });
        });
        req.on('error', e => {
            console.error(`Error with [${label}]: ${e.message}\n`);
            resolve();
        });
        req.end();
    });
};

async function run() {
    console.log("=== NEGATIVE TESTS ===\n");
    await makeRequest('POST', '/api/super-admin/tenants', tenantToken, 'Tenant Token to Global Admin Route');
    await makeRequest('POST', '/api/prescriptions/123/execute', globalToken, 'Global Token to Tenant EMR Route');
    await makeRequest('GET', '/api/global/products', tenantToken, 'Tenant Token to /api/global/products (After Fix)');
    await makeRequest('GET', '/api/reference/products', tenantToken, 'Tenant Token to /api/reference/products (Valid Read)');
}

run();
