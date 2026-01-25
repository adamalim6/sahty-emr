
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const DATA_DIR = path.join(__dirname, '../data/tenants');

if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    process.exit(1);
}

const files = fs.readdirSync(DATA_DIR);
const tenants: string[] = [];

files.forEach(f => {
    const fullPath = path.join(DATA_DIR, f);
    if (fs.statSync(fullPath).isDirectory()) {
        // Look for .db inside
        const dbFiles = fs.readdirSync(fullPath).filter(db => db.endsWith('.db') && db.startsWith('client_'));
        dbFiles.forEach(db => tenants.push(path.join(f, db)));
    } else if (f.endsWith('.db') && f.startsWith('client_')) {
        tenants.push(f);
    }
});

console.log(`Found ${tenants.length} tenants to migrate.`);

console.log('--- START MIGRATION: ADD STOCK RESERVATIONS ---');

tenants.forEach(tenantRelPath => {
    const dbPath = path.join(DATA_DIR, tenantRelPath);
    const tenantId = path.basename(dbPath).replace('.db', '');
    console.log(`Migrating ${tenantId} at ${dbPath}...`);

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Create Table
        db.run(`
            CREATE TABLE IF NOT EXISTS stock_reservations (
                reservation_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                demand_id TEXT,
                demand_line_id TEXT,
                product_id TEXT NOT NULL,
                lot TEXT,
                expiry DATE,
                location_id TEXT NOT NULL,
                qty_units INTEGER NOT NULL CHECK(qty_units > 0),
                status TEXT DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, COMMITTED, EXPIRED
                reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                released_at DATETIME,
                committed_at DATETIME,
                transfer_id TEXT,
                transfer_line_id TEXT,
                client_request_id TEXT
            )
        `, (err) => {
            if (err) console.error(`Error creating stock_reservations for ${tenantId}:`, err);
        });

        // 2. Create Indices
        db.run(`CREATE INDEX IF NOT EXISTS idx_res_active ON stock_reservations(tenant_id, location_id, product_id, lot, expiry) WHERE status = 'ACTIVE'`, [], (err) => { if(err) console.error(err.message)});
        db.run(`CREATE INDEX IF NOT EXISTS idx_res_session ON stock_reservations(tenant_id, session_id) WHERE status = 'ACTIVE'`, [], (err) => { if(err) console.error(err.message)});
        db.run(`CREATE INDEX IF NOT EXISTS idx_res_expires ON stock_reservations(status, expires_at) WHERE status = 'ACTIVE'`, [], (err) => { if(err) console.error(err.message)});
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_res_idempotency ON stock_reservations(tenant_id, client_request_id) WHERE client_request_id IS NOT NULL`, [], (err) => { if(err) console.error(err.message)});

        db.run("COMMIT", (err) => {
            if (err) console.error(`Failed to commit for ${tenantId}:`, err);
            else console.log(`✓ Migrated ${tenantId}`);
        });
    });

    db.close();
});

console.log('--- MIGRATION COMPLETE ---');
