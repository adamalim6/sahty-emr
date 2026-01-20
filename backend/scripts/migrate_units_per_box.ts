
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

const all = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows as T[]); });
});

async function migrate() {
    console.log("Starting Units Per Box Migration...");
    const db = await getGlobalDB();

    // 1. Check if column exists
    try {
        await run(db, 'SELECT units_per_pack FROM global_products LIMIT 1');
        console.log("Column 'units_per_pack' already exists.");
    } catch (e) {
        console.log("Adding 'units_per_pack' column...");
        await run(db, 'ALTER TABLE global_products ADD COLUMN units_per_pack INTEGER DEFAULT 1');
    }

    // 2. Fetch all products
    const products = await all<any>(db, 'SELECT id, presentation FROM global_products');
    console.log(`Scanning ${products.length} products for unit extraction...`);

    let updates = 0;
    
    await run(db, 'BEGIN TRANSACTION');

    try {
        for (const p of products) {
            if (!p.presentation) continue;

            const text = p.presentation.toUpperCase();
            let units = 1;

            // Regex Patterns
            // BOITE DE 30 ...
            // ETUI DE 1 ...
            // FLACON DE ... (Usually 1 unit, but let's see. "FLACON DE 100 ML" is 1 unit. "BOITE DE 10 FLACONS" is 10)
            
            const boiteMatch = text.match(/(?:BOITE|ETUI|TUBES?)\s+DE\s+(\d+)/);
            if (boiteMatch) {
                units = parseInt(boiteMatch[1]);
            } else if (text.includes("FLACON") || text.includes("TUBE")) {
                // Check if it says "BOITE DE X FLACONS" -> handled above.
                // If just "FLACON DE 5 ML", units = 1.
                // Wait, if presentation says "30 COMPRIMES", handle that?
                const directMatch = text.match(/^(\d+)\s+(?:CP|COMPRIMES|GELULES|SACHETS)/);
                if (directMatch) {
                    units = parseInt(directMatch[1]);
                }
            }

            if (units > 1) {
                await run(db, 'UPDATE global_products SET units_per_pack = ? WHERE id = ?', [units, p.id]);
                updates++;
                if (updates % 100 === 0) process.stdout.write('.');
            }
        }
        
        await run(db, 'COMMIT');
        console.log(`\nMigration complete. Updated ${updates} products.`);

    } catch (err) {
        await run(db, 'ROLLBACK');
        console.error("Migration failed:", err);
    }
}

migrate().catch(console.error);
