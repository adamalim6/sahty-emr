import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runGlobalMigration065() {
    console.log('--- Running Global Migration 065 (Smart Phrases) ---');
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/065_create_smart_phrases_global.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing ${sqlPath}...`);
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Global Migration 065 Successful.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Global Migration 065 Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runGlobalMigration065().catch(console.error);
