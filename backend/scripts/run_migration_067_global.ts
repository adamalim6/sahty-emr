import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runGlobalMigration() {
    console.log('--- Running Global Migration 067 (Remove lab_units) ---');
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/067_remove_lab_units_global.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing ${sqlPath}...`);
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Global Migration 067 Successful.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Global Migration 067 Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runGlobalMigration().catch(console.error);
