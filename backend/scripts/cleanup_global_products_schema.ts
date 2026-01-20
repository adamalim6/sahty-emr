
import { getGlobalDB } from '../db/globalDb';
import { Database } from 'sqlite3';

const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

const get = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row as T); });
});

const all = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows as T[]); });
});

async function migrate() {
    console.log("Starting Global Products Schema Cleanup...");
    const db = await getGlobalDB();

    try {
        await run(db, 'BEGIN TRANSACTION');

        // 1. Rename existing table
        console.log("Renaming existing table...");
        await run(db, 'ALTER TABLE global_products RENAME TO global_products_old');

        // 2. Create new table with DESIRED schema (no dci, dosage, dosage_unit, atc_code)
        console.log("Creating new table...");
        await run(db, `
            CREATE TABLE global_products (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                form TEXT,
                dci_composition TEXT,
                presentation TEXT,
                manufacturer TEXT,
                ppv REAL,
                ph REAL,
                class_therapeutique TEXT,
                sahty_code TEXT,
                units_per_pack INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        `);

        // 3. Copy data
        console.log("Copying data...");
        // Select matching columns from old table. Note: 'dosage_unit' and 'dci' are ignored.
        // We need to map old columns to new ones carefully.
        // Old schema had: id, type, name, dci, form, dosage, presentation, manufacturer, ppv, ph, class_therapeutique, atc_code, is_active, created_at, units_per_pack, sahty_code, dosage_unit, dci_composition
        
        // We select only the ones we want to keep.
        // Note: 'updated_at' might not exist in old table? Check PRAGMA output from Step 5899.
        // PRAGMA output: 13|created_at... NO updated_at in old table!
        // So we default updated_at to created_at
        
        await run(db, `
            INSERT INTO global_products (
                id, type, name, form, dci_composition, presentation, manufacturer, 
                ppv, ph, class_therapeutique, sahty_code, units_per_pack, is_active, created_at, updated_at
            )
            SELECT 
                id, type, name, form, dci_composition, presentation, manufacturer, 
                ppv, ph, class_therapeutique, sahty_code, units_per_pack, is_active, created_at, created_at
            FROM global_products_old
        `);

        // 4. Verify count
        const oldStart = await get<any>(db, 'SELECT count(*) as c FROM global_products_old');
        const newStart = await get<any>(db, 'SELECT count(*) as c FROM global_products');
        console.log(`Migrated ${newStart.c} rows (Old was ${oldStart.c})`);

        if (oldStart.c !== newStart.c) {
            throw new Error(`Row count mismatch! Old: ${oldStart.c}, New: ${newStart.c}`);
        }

        // 5. Drop old table
        console.log("Dropping old table...");
        await run(db, 'DROP TABLE global_products_old');

        await run(db, 'COMMIT');
        console.log("Migration successful!");

    } catch (error) {
        console.error("Migration failed:", error);
        await run(db, 'ROLLBACK');
    }
}

migrate().catch(console.error);
