const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev_secret_2026'; // Default from authService.ts for dev

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
                console.log(`[${label}] \n${method} ${path}\nExpected: 403 Forbidden (Invalid Realm)\nActual: HTTP ${res.statusCode} ${res.statusMessage}`);
                if (res.statusCode !== 403) console.log(`Response Payload: ${data}`);
                console.log('---');
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
    await makeRequest('POST', '/api/super-admin/tenants', tenantToken, 'Tenant token -> POST /api/super-admin/tenants');
    await makeRequest('POST', '/api/prescriptions/123/execute', globalToken, 'Global token -> POST /api/prescriptions/:id/execute');
    await makeRequest('GET', '/api/global/products', tenantToken, 'Tenant token -> GET /api/global/products');
}

run();
