import axios from 'axios';
import { Pool } from 'pg';

async function testHttp() {
    // We need an auth token to hit the endpoint. The easiest way is to mock a token or 
    // bypass it. Since we are testing from outside, let's just generate a quick signed token.
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({
      userId: 'a720c03a-f492-46e6-ae4d-14f639392087',
      realm: 'tenant',
      tenantId: 'ced91ced-fe46-45d1-8ead-b5d51bad5895',
      permissions: [],
      modules: []
    }, process.env.JWT_SECRET || 'super-secret-key-change-in-prod');

    console.log("Token generated. Hitting API...");
    try {
        const res = await axios.post(
            'http://localhost:5000/api/surveillance/patients/a720c03a-f492-46e6-ae4d-14f639392087/cells',
            {
                tenantPatientId: 'a720c03a-f492-46e6-ae4d-14f639392087',
                parameterId: '995df62d-4083-4f19-8136-6d0a730b181b', // APPORTS_HYD_CR_MAN
                parameterCode: 'APPORTS_HYD_CR_MAN',
                recordedAt: new Date().toISOString(),
                value: 300
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        console.log("HTTP SUCCESS:", JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log("HTTP FAILED:", e.response?.status, e.response?.data || e.message);
    }
}
testHttp().catch(console.error);
