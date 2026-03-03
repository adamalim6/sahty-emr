import { query } from '../db/pg';
import { tenantQuery } from '../db/tenantPg';

async function main() {
    try {
        // Just use the first tenant we can find
        const res = await query('SELECT id FROM sahty_global.tenants LIMIT 1', []);
        if (res.length > 0) {
            const tenantId = res[0].id;
            const units = await tenantQuery(tenantId, 'SELECT * FROM reference.units WHERE code = $1', ['POCHE']);
            console.log("POCHE units found in tenant:", units);
        } else {
            console.log("No tenants found.");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
main();
