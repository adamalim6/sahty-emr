import { transfusionService } from './services/transfusionService';
import 'dotenv/config';

async function run() {
    try {
        const patientId = 'e3bc09ea-8b61-4eea-858d-35e8949fe150'; // from user's screenshot URL
        const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
        
        const res = await transfusionService.getTransfusionTimeline(tenantId, patientId);
        console.log(`Found ${res.prescriptions.length} transfusions and ${res.bags.length} bags.`);
    } catch (e: any) {
        console.error('FAILED:', e.message);
    }
}
run();
