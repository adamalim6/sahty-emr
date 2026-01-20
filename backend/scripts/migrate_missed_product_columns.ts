
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

async function migrate() {
    console.log("Starting Product Columns Migration (dosage_unit, dci_composition)...");
    const db = await getGlobalDB();

    // 1. Ensure columns exist
    try {
        await run(db, 'SELECT dosage_unit FROM global_products LIMIT 1');
    } catch (e) {
        console.log("Adding 'dosage_unit' column...");
        await run(db, 'ALTER TABLE global_products ADD COLUMN dosage_unit TEXT');
    }

    try {
        await run(db, 'SELECT dci_composition FROM global_products LIMIT 1');
    } catch (e) {
        console.log("Adding 'dci_composition' column...");
        await run(db, 'ALTER TABLE global_products ADD COLUMN dci_composition TEXT');
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

            // Extract logic
            const dosageUnit = p.dosageUnit || null; // Top level if exists
            const dciComposition = p.dciComposition ? JSON.stringify(p.dciComposition) : '[]';

            // Also checking if top-level dosage is missing in DB but present in JSON?
            // Schema has `dosage TEXT`. JSON has `dosage` (number? or text?)
            // Legacy JSON sample: `dosage` is NOT at top level in sample, but inside dciComposition.
            // If `dosage` column exists, let's update it too if we find it.

            await run(db, `
                UPDATE global_products 
                SET dosage_unit = ?, dci_composition = ?
                WHERE id = ?
            `, [dosageUnit, dciComposition, p.id]);

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
