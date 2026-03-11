import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { authenticateToken } from './middleware/authMiddleware';
import { createObservation } from './controllers/observationsController';

const token = jwt.sign({
    userId: 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a0',
    username: 'medt',
    // NO nom OR prenom here, to simulate old or missing token claims
    role: 'MEDECIN',
    realm: 'tenant',
    tenantId: 'ced91ced-fe46-45d1-8ead-b5d51bad5895',
    user_type: 'TENANT_USER'
}, process.env.JWT_SECRET || 'super-secret-key-change-in-prod');

async function run() {
    const req = {
        headers: {
            authorization: `Bearer ${token}`
        },
        body: {
            tenant_patient_id: 'e3bc09ea-8b61-4eea-858d-35e8949fe150',
            note_type: 'GENERAL',
            privacy_level: 'NORMAL',
            declared_time: new Date().toISOString(),
            status: 'DRAFT',
            body_html: '<p>test</p>'
        }
    } as unknown as Request;

    const res = {
        status: (code: number) => {
            console.log('Status:', code);
            return res;
        },
        json: (data: any) => {
            console.log('Response:', data);
        }
    } as Response;

    authenticateToken(req as any, res, async () => {
        try {
            await createObservation(req, res);
        } catch(e) {
            console.error("CATCH:", e.message);
        }
        process.exit(0);
    });
}

run();
