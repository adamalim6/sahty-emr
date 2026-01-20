
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

async function migrate() {
    console.log("Starting Units Per Box & Sahty Code Migration from Legacy JSON...");
    const db = await getGlobalDB();

    // 1. Ensure columns exist
    try {
        await run(db, 'SELECT units_per_pack FROM global_products LIMIT 1');
    } catch (e) {
        console.log("Adding 'units_per_pack' column...");
        await run(db, 'ALTER TABLE global_products ADD COLUMN units_per_pack INTEGER DEFAULT 1');
    }

    try {
        await run(db, 'SELECT sahty_code FROM global_products LIMIT 1');
    } catch (e) {
        console.log("Adding 'sahty_code' column...");
        await run(db, 'ALTER TABLE global_products ADD COLUMN sahty_code TEXT');
    }

    // 2. Read Legacy JSON
    const legacyPath = path.join(__dirname, '../data/legacy_json_backup_1768868149841/global/products.json');
    if (!fs.existsSync(legacyPath)) {
        console.error("Legacy file not found:", legacyPath);
        return;
    }

    console.log("Reading legacy JSON...");
    const rawData = fs.readFileSync(legacyPath, 'utf-8');
    const legacyProducts = JSON.parse(rawData);
    console.log(`Loaded ${legacyProducts.length} legacy products.`);

    let updates = 0;
    
    await run(db, 'BEGIN TRANSACTION');

    try {
        for (const p of legacyProducts) {
            if (!p.id) continue;

            const units = p.unitsPerBox || 1;
            const sahtyCode = p.sahtyCode || null;

            // Update both fields
            await run(db, `
                UPDATE global_products 
                SET units_per_pack = ?, sahty_code = ? 
                WHERE id = ?
            `, [units, sahtyCode, p.id]);

            updates++;
            if (updates % 500 === 0) process.stdout.write('.');
        }
        
        await run(db, 'COMMIT');
        console.log(`\nMigration complete. Updated ${updates} products.`);

    } catch (err) {
        await run(db, 'ROLLBACK');
        console.error("Migration failed:", err);
    }
}

migrate().catch(console.error);
