
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

async function migrate() {
    console.log("Starting PFHT Migration from Legacy JSON...");
    const db = await getGlobalDB();

    // 1. Read Legacy JSON
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

            // Extract PFHT
            const pfht = p.marketInfo?.pfht || 0;

            // Only update if we have a value (or explicit 0 provided in legacy, though typically we want non-zero prices if possible)
            // But if legacy has 0, we should probably respect it or keep it as is.
            // The user wants to "import values", so even 0 is a value.
            
            await run(db, `
                UPDATE global_products 
                SET pfht = ?
                WHERE id = ?
            `, [pfht, p.id]);

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
