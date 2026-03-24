import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runGlobalMigration() {
    console.log('--- Running Global Migration 066 (Laboratory Reference Foundation) ---');
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/066_laboratory_reference_foundation.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing ${sqlPath}...`);
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Global Migration 066 Successful.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Global Migration 066 Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runGlobalMigration().catch(console.error);
