import { tenantQuery } from '../db/tenantPg';

async function check() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const res = await tenantQuery(tenantId, `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'surveillance_hour_buckets';
    `);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
check().catch(console.error);
