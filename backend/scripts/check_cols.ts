import { tenantQuery } from '../db/tenantPg';

async function check() {
    try {
        const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
        const cols = await tenantQuery(tenantId, "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'patients_tenant'");
        console.log("Columns:", cols);
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
    process.exit(0);
}

check();
