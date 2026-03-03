import { tenantQuery } from './db/tenantPg';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log("Testing getDiagnoses exact controller query...");
        const result = await tenantQuery('ced91ced-fe46-45d1-8ead-b5d51bad5895', `
            SELECT * FROM public.patient_diagnoses 
            WHERE patient_id = $1
            ORDER BY entered_at DESC;
        `, ['2a96aac3-9cdb-4912-bb55-2bb3fec17805']);
        console.log("Result:", result);
    } catch (e) {
        console.error("FAILED DB QUERY EXACT:", e);
    }
    process.exit(0);
}
test();
