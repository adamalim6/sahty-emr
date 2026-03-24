const { Pool } = require('pg');

const gPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });
const tPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });

async function run() {
    try {
        const globalRes = await gPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        const globalTables = globalRes.rows.map(r => r.table_name);
        
        const tenantRes = await tPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='reference'");
        const tenantTables = tenantRes.rows.map(r => r.table_name);
        
        const missing = globalTables.filter(t => !tenantTables.includes(t) && t !== 'users');
        
        console.log('--- DIAGNOSTIC RESULTS ---');
        console.log('Total Global Tables:', globalTables.length);
        console.log('Total Tenant Reference Tables:', tenantTables.length);
        console.log('Missing from Tenant:', missing);
    } catch (e) {
        console.error(e);
    } finally {
        await gPool.end();
        await tPool.end();
    }
}

run();
