import { prescriptionService } from './services/prescriptionService';
import { referenceDataService } from './services/referenceDataService';
import { tenantQuery } from './db/tenantPg';

const run = async () => {
    try {
        const tenantId = 'tenant_1'; // Just a guess, let's look up tenant for patient
        const tenants = await tenantQuery('GLOBAL', 'SELECT id, db_name FROM tenants');
        console.log("Tenants:", tenants);

        const patientId = '6f537c9a-e7e3-40d8-8659-9c785baa927d';

        // Check which tenant has the patient
        let foundTenant = null;
        for (const t of tenants) {
            try {
                const res = await tenantQuery(t.id, 'SELECT id FROM patients WHERE id = $1', [patientId]);
                if (res.length > 0) {
                    foundTenant = t.id;
                    break;
                }
            } catch (e) {}
        }
        
        console.log("Patient belongs to:", foundTenant);
        if (foundTenant) {
            const pres = await prescriptionService.getPrescriptionsByPatient(foundTenant, patientId);
            console.log("Prescriptions payload length:", pres.length);
            if (pres.length > 0) {
                console.log("First pres status:", pres[0].status, pres[0].derived_status);
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};
run();
