
import { globalTransaction } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function run004Migration() {
    console.log('--- Running Global Migration (004) ---');
    
    await globalTransaction(async (client) => {
        const sqlPath = path.join(__dirname, '../migrations/pg/global/004_move_document_types_public.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✅ Migration 004 Successful.');
    });
}

run004Migration().catch(console.error);
