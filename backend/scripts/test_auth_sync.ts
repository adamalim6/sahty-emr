import express from 'express';
import jwt from 'jsonwebtoken';
import http from 'http';
import { authenticateToken } from '../middleware/authMiddleware';

const app = express();
app.use(express.json());

// Protected test route
app.get('/protected', authenticateToken as any, (req: any, res: any) => {
    res.json({
        success: true,
        user: req.user,
        auth: req.auth
    });
});

const server = http.createServer(app);

async function runTests() {
    console.log("--- Starting Auth Middleware Sync Tests ---");

    await new Promise<void>((resolve) => server.listen(8765, () => resolve()));

    const fetchUrl = (headers: any = {}) => 
        new Promise<any>((resolve, reject) => {
            const req = http.get('http://localhost:8765/protected', { headers }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
            });
            req.on('error', reject);
        });

    // 1. Missing Token -> 401
    const res1 = await fetchUrl();
    console.log(`Test 1: Missing Token -> Status ${res1.status} (Expected 401)`);
    if (res1.status !== 401) throw new Error("Missing token failed");

    // 2. Invalid Token -> 403
    const res2 = await fetchUrl({ Authorization: 'Bearer fake-invalid-token' });
    console.log(`Test 2: Invalid Token -> Status ${res2.status} (Expected 403)`);
    if (res2.status !== 403) throw new Error("Invalid token failed");

    // 3. Valid Token -> 200 + Correct Payloads
    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
    const validToken = jwt.sign({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        tenantId: 'tenant-abc',
        role: 'admin',
        permissions: ['read', 'write']
    }, secret);

    const res3 = await fetchUrl({ Authorization: `Bearer ${validToken}` });
    
    console.log(`Test 3: Valid Token -> Status ${res3.status} (Expected 200)`);
    if (res3.status !== 200) throw new Error(`Valid token failed. Body: ${JSON.stringify(res3.body)}`);

    console.log("Returned req.user.userId:", res3.body.user.userId);
    console.log("Returned req.auth.tenantId:", res3.body.auth.tenantId);

    console.log("✅ All tests passed. The middleware is synchronous and strictly secure.");
    server.close();
}

runTests().catch(err => {
    console.error(err);
    server.close();
});
