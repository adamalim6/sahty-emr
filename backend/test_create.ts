import 'dotenv/config';
import { prescriptionService } from './services/prescriptionService';

async function run() {
    try {
        const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
        const patientId = 'bf68c8e3-daf9-48ca-95f5-12a93c44c7c3';
        const data = {
            "molecule": "ALPHA-KADOL 0 TUBE DE 35 G POMMADE",
            "qty": "10",
            "unit": "mg",
            "route": "Orale",
            "schedule": {
                "mode": "standard"
            },
            "conditionComment": "",
            "prescriptionType": "medication"
        };
        const res = await prescriptionService.createPrescription(
            tenantId,
            patientId,
            null,
            data as any,
            'test_user',
            'Test',
            'User'
        );
        console.log("SUCCESS:", res.id);
    } catch(e: any) {
        console.error("FAILURE SQL:", e.message, e.stack);
    }
    process.exit(0);
}
run();
