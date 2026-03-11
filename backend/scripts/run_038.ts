import { globalQuery } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    try {
        const poolForDiscovery = new Pool({
            host: 'localhost', port: 5432, user: 'sahty',
            password: 'sahty_dev_2026',
            database: 'postgres'
        });
        const result = await poolForDiscovery.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const migrationSql = fs.readFileSync(
            path.join(__dirname, '../../migrations/pg/tenant/038_surveillance_trigger.sql'), 'utf-8'
        );

        for (const row of result.rows) {
            const tenantDb = row.datname;
            const tenantId = tenantDb.replace('tenant_', '');
            console.log(`Applying migration 038 to: ${tenantId} (${tenantDb})`);

            const pool = getTenantPool(tenantId);
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                await client.query(migrationSql);
                await client.query('COMMIT');
                console.log(`  [+] Success for ${tenantId}`);
            } catch (err: any) {
                await client.query('ROLLBACK');
                console.error(`  [-] Failed on ${tenantId}:`, err.message);
            } finally {
                client.release();
            }
        }
    } catch(e: any) {
        console.error('FAILED GLOBAL:', e.message);
    } finally {
        process.exit();
    }
}

main();
