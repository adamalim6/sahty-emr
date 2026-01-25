
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');
const db = new sqlite3.Database(DB_PATH);

console.log(`--- APPLYING MIGRATION: ADD unit_sale_price ---`);

db.run(`ALTER TABLE product_price_versions ADD COLUMN unit_sale_price NUMERIC(12,4)`, [], (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column already exists. Skipping.');
        } else {
            console.error('Migration failed:', err);
        }
    } else {
        console.log('Migration successful: Column added.');
    }
});
