import { tenantQuery } from './backend/db/tenantPg';
async function test() {
    try {
        const res = await tenantQuery('tenant_3f6d', 'SELECT * FROM auth.users LIMIT 1;');
        console.log("Success:", JSON.stringify(res[0]));
    } catch(e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
test();
