import 'dotenv/config';
import { tenantQuery } from './db/tenantPg';

async function run() {
    try {
        const res = await tenantQuery('demo', `SELECT * FROM reference.global_dci LIMIT 1;`);
        console.log("SUCCESS");
    } catch(e: any) {
        console.error("FAILURE SQL:", e.message);
    }
    process.exit(0);
}
run();
