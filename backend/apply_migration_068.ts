import { getTenantPool } from './db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function run() {
    const pool = getTenantPool(TENANT_ID);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sqlPath = path.join(__dirname, 'migrations', 'pg', 'tenant', '068_surveillance_trigger.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Executing migration on tenant ${TENANT_ID}...`);
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Success!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
