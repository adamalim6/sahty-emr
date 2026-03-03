import { globalQuery } from '../db/globalPg';
async function test() {
    try {
        const res = await globalQuery('SELECT * FROM tenants LIMIT 1');
        console.log("Columns:", Object.keys(res.rows[0]));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
