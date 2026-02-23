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
        const sql = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/tenant/055b_created_by_to_uuid.sql'), 'utf-8'
        );
        await pool.query(sql);
        console.log('[+] Migration 055b applied successfully');

        // Verify column type
        const check = await pool.query(`
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'prescriptions'
            AND column_name = 'created_by'
        `);
        console.log('created_by type:', check.rows[0]?.data_type);
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
