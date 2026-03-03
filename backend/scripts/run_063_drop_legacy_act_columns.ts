import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runGlobalMigration() {
    console.log('--- Running Global Actes Refactor Migration ---');
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/063_drop_legacy_act_columns.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing ${sqlPath}...`);
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log('✅ Columns dropped in sahty_global.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runGlobalMigration().catch(console.error);
