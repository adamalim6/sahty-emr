import { tenantQuery } from './db/tenantPg';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log("Testing getPatient logic:");
        const pCheck = await tenantQuery('ced91ced-fe46-45d1-8ead-b5d51bad5895', 'SELECT tenant_patient_id FROM public.patients_tenant WHERE tenant_patient_id = $1', ['2a96aac3-9cdb-4912-bb55-2bb3fec17805']);
        console.log("Check Result:", pCheck);
    } catch (e) {
        console.error("FAILED DB QUERY:", e);
    }
    process.exit(0);
}
test();
