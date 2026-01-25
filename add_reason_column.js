
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TENANTS_DIR = path.join(__dirname, 'backend/data/tenants');

async function migrate() {
    console.log(`Scanning tenants in: ${TENANTS_DIR}`);
    if (!fs.existsSync(TENANTS_DIR)) {
        console.error("Tenants directory not found!");
        return;
    }
    const tenants = fs.readdirSync(TENANTS_DIR).filter(f => f.startsWith('client_'));
    
    for (const tenantId of tenants) {
        const dbPath = path.join(TENANTS_DIR, tenantId, `${tenantId}.db`);
        if (!fs.existsSync(dbPath)) continue;
        
        console.log(`Migrating tenant: ${tenantId}`);
        const db = new sqlite3.Database(dbPath);
        
        await new Promise((resolve, reject) => {
            db.run(`ALTER TABLE product_price_versions ADD COLUMN change_reason TEXT DEFAULT '-'`, (err) => {
                if (err && err.message.includes('duplicate column')) {
                    console.log('Column already exists.');
                    resolve(null);
                } else if (err) {
                    console.error(`Error migrating ${tenantId}:`, err);
                    reject(err);
                } else {
                    console.log(`Added change_reason to ${tenantId}`);
                    resolve(null);
                }
            });
        });
        
        db.close();
    }
}

migrate().then(() => console.log('Done')).catch(console.error);
