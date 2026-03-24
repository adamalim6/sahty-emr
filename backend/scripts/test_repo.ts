import { getTenantPool } from '../db/tenantPg';
import { LabReferenceRepository } from '../repositories/labReferenceRepository';

async function run() {
  try {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    const client = await pool.connect();
    const repo = new LabReferenceRepository();
    const results = await repo.searchLabAnalytesOrActs(client, 'plaqu');
    console.log('Results for "plaqu":', results);
    client.release();
  } catch (e) {
    console.error(e);
  }
}

run().then(() => process.exit(0));
