
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');

const db = new sqlite3.Database(DB_PATH);

const run = (sql: string) => new Promise<void>((resolve, reject) => {
    db.run(sql, function(err) {
        if (err) {
            console.error(`Error running ${sql}:`, err.message);
            // resolve(); // Proceed anyway?
            reject(err);
        } else {
            console.log(`Success: ${sql.substring(0, 50)}...`);
            resolve();
        }
    });
});

async function migrate() {
    try {
        console.log('Migrating Tenant DB (Cleanup):', DB_PATH);

        // SQLite DROP COLUMN (requires 3.35.0+, checked via logic or just try)
        // If fails, we might need table rebuild. But let's try ALTER TABLE DROP COLUMN first.
        
        try {
            await run(`ALTER TABLE product_suppliers DROP COLUMN is_preferred`);
            console.log('Dropped is_preferred column');
        } catch (e) { 
            console.log('Drop column failed (might not exist or old sqlite):', e);
            // If strictly needed, we would rename table, create new, copy, drop old.
            // But if it fails because it doesn't exist, that's fine.
        }

        console.log('Migration Cleanup Complete');
    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        db.close();
    }
}

migrate();
