import { globalQuery, closeGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    try {
        console.log("Applying Migration 009...");
        const sqlPath = path.join(__dirname, '../migrations/pg/global/009_add_product_presc_defaults.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await globalQuery(sql);
        console.log("Migration 009 applied successfully to sahty_global.");
    } catch (e) {
        console.error("Failed to migrate:", e);
        process.exit(1);
    } finally {
        await closeGlobalPool();
    }
}

main();
