
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');

const db = new sqlite3.Database(DB_PATH);

const run = (sql: string) => new Promise<void>((resolve, reject) => {
    db.run(sql, function(err) {
        if (err) {
            console.error(`Error running ${sql}:`, err.message);
            reject(err);
        } else {
            console.log(`Success: ${sql.substring(0, 50)}...`);
            resolve();
        }
    });
});

async function cleanup() {
    try {
        console.log('Cleaning up product_configs in:', DB_PATH);
        
        try {
            await run(`ALTER TABLE product_configs DROP COLUMN sales_price`);
            console.log('Dropped sales_price column');
        } catch (e) { console.log('sales_price likely already gone or error:', e); }

        try {
            await run(`ALTER TABLE product_configs DROP COLUMN active_price_version_id`);
            console.log('Dropped active_price_version_id column');
        } catch (e) { console.log('active_price_version_id likely already gone or error:', e); }

        console.log('Cleanup Complete');
    } catch (error) {
        console.error('Cleanup Failed:', error);
    } finally {
        db.close();
    }
}

cleanup();
