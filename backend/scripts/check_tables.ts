import { tenantQuery } from '../db/tenantPg';

async function check() {
    try {
        const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
        const uRes = await tenantQuery(tenantId, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(uRes.map(u => u.table_name));
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
    process.exit(0);
}

check();
