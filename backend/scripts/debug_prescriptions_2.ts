import { prescriptionService } from '../services/prescriptionService';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';

    try {
        const prescriptions = await prescriptionService.getPrescriptionsByPatient(tenantId, patientId);
        console.dir(prescriptions, { depth: null });
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
