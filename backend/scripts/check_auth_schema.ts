import { tenantQuery } from '../db/tenantPg';
async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const authRes = await tenantQuery(tenantId, "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users'");
    console.log('Auth users columns:', JSON.stringify(authRes, null, 2));

    const publicRes = await tenantQuery(tenantId, "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
    console.log('Public users columns:', JSON.stringify(publicRes, null, 2));
    process.exit(0);
}
run();
