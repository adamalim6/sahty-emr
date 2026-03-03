import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    // Note: In Sahty scripts, usually it loops over tenants, but for prototype we can hit the known tenant.
    // Or we hit all tenants if there's a loop. Here I'll copy the 053 hardcoded tenant.
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        const mig054 = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/tenant/054_enforce_admin_event_identity.sql'), 'utf-8'
        );
        await pool.query(mig054);
        console.log('[+] Migration 054 applied successfully');

    } catch(e: any) {
        console.error('FAILED:', e.message);
        console.error(e.stack);
    } finally {
        await pool.end();
    }
}

main();
