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
        // Apply 053 (which is idempotent and handles 051/052 column additions too)
        const mig053 = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/tenant/053_split_administration_events.sql'), 'utf-8'
        );
        await pool.query(mig053);
        console.log('[+] Migration 053 applied successfully');

        // Verify tables
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('prescriptions', 'prescription_events', 'administration_events')
            ORDER BY table_name
        `);
        console.log('\nTables present:', tables.rows.map((r: any) => r.table_name));

        // Verify prescription_events columns (should be plan-only)
        const peCols = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'prescription_events' ORDER BY ordinal_position
        `);
        console.log('\nprescription_events columns:', peCols.rows.map((r: any) => r.column_name));

        // Verify administration_events columns
        const aeCols = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'administration_events' ORDER BY ordinal_position
        `);
        console.log('\nadministration_events columns:', aeCols.rows.map((r: any) => r.column_name));

        // Verify prescriptions columns
        const rxCols = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'prescriptions' ORDER BY ordinal_position
        `);
        console.log('\nprescriptions columns:', rxCols.rows.map((r: any) => r.column_name));

    } catch(e: any) {
        console.error('FAILED:', e.message);
        console.error(e.stack);
    } finally {
        await pool.end();
    }
}

main();
