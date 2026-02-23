import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        const mig056 = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/tenant/056_surveillance_jsonb_flowsheets.sql'), 'utf-8'
        );
        await pool.query(mig056);
        console.log('[+] Migration 056 applied successfully');

        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('surveillance_hour_buckets', 'observation_parameters', 'observation_groups', 'observation_flowsheets', 'flowsheet_groups', 'group_parameters')
            ORDER BY table_name
        `);
        console.log('\nTables present:', tables.rows.map((r: any) => r.table_name));

    } catch(e: any) {
        console.error('FAILED:', e.message);
        console.error(e.stack);
    } finally {
        await pool.end();
    }
}

main();
