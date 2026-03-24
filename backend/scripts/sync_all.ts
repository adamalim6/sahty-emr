import { Pool } from 'pg';
import { syncTenantReference } from './referenceSync';

const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });

async function run() {
    try {
        console.log("Fetching all tenants...");
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = res.rows.map(r => r.datname);
        
        for (const dbName of tenants) {
            console.log(`Syncing ${dbName}...`);
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            const client = await pool.connect();
            try {
                const tenantId = dbName.replace('tenant_', '');
                await client.query('BEGIN');
                await syncTenantReference(client, tenantId);
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`Failed on ${dbName}:`, e);
            } finally {
                client.release();
                await pool.end();
            }
        }
        console.log("All tenants synced.");
    } catch (e) {
        console.error("Global error:", e);
    } finally {
        await adminPool.end();
    }
}

run();
