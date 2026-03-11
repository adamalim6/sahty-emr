import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const globalPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10000,
});

async function run() {
    const clientsRes = await globalPool.query('SELECT tenant_id FROM tenant_catalog WHERE schema_status = \'PROVISIONED\'');
    const tenants = clientsRes.rows.map(r => r.tenant_id);

    const basePath = path.join(process.cwd(), 'migrations', 'pg', 'tenant');
    const fileContent = fs.readFileSync(path.join(basePath, '068_surveillance_trigger.sql'), 'utf-8');

    for (const tenantId of tenants) {
        console.log(`Applying 068 to tenant: ${tenantId}`);
        const pool = new Pool({
             connectionString: process.env.DATABASE_URL,
             max: 2,
        });

        try {
            await pool.query(`SET search_path TO "tenant_${tenantId}", public`);
            await pool.query(fileContent);
            console.log(`Successfully applied 068 to ${tenantId}`);
        } catch (e) {
            console.error(`Error applying 068 to ${tenantId}`, e);
        } finally {
            await pool.end();
        }
    }
}

run().catch(console.error).finally(() => globalPool.end());
