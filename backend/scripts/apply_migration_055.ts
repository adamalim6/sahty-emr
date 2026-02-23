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
            path.join(__dirname, '../migrations/pg/tenant/055_prescriber_name_columns.sql'), 'utf-8'
        );
        await pool.query(sql);
        console.log('[+] Migration 055 applied successfully');

        // Verify columns exist
        const check = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'prescriptions'
            AND column_name IN ('created_by_first_name', 'created_by_last_name')
            ORDER BY column_name
        `);
        console.log('New columns:', check.rows.map((r: any) => r.column_name).join(', '));
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
