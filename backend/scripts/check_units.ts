import { tenantQuery } from '../db/tenantPg';

async function check() {
    try {
        const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
        const uRes = await tenantQuery(tenantId, "SELECT * FROM reference.units");
        console.log(uRes);
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
    process.exit(0);
}

check();
