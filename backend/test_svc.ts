import { transfusionService } from './services/transfusionService';
import dotenv from 'dotenv';
dotenv.config();

const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087';

async function run() {
  try {
    const res = await transfusionService.getTransfusionTimeline(tenantId, patientId);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
