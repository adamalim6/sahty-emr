import { globalQuery } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runGlobalMigration() {
    console.log('--- Running Global Migration 064 (MAR Performance & Hydric) ---');
    
    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/064_mar_performance.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Executing 064_mar_performance.sql...`);
        await globalQuery(sql);
        console.log(`✅ Global Migration Successful.`);
    } catch (e) {
        console.error(`❌ Global Migration Failed:`, e);
    }
    process.exit(0);
}

runGlobalMigration().catch(console.error);
