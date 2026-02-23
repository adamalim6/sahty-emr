import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function applyGlobalMigration() {
    const pool = getGlobalPool();
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/012_observation_catalog.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await client.query(sql);
        console.log('[+] Applied 012_observation_catalog to sahty_global');
    } catch (e) {
        console.error('Migration failed', e);
    } finally {
        client.release();
        await pool.end();
    }
}

applyGlobalMigration();
