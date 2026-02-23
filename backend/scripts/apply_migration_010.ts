import { globalQuery, closeGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    try {
        console.log("Applying Migration 010...");
        const sqlPath = path.join(__dirname, '../migrations/pg/global/010_ref_schema_changelog.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await globalQuery(sql);
        console.log("Migration 010 applied successfully to sahty_global.");
    } catch (e) {
        console.error("Failed to migrate:", e);
        process.exit(1);
    } finally {
        await closeGlobalPool();
    }
}

main();
