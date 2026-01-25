
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const TENANTS_DIR = path.join(__dirname, '../data/tenants');

async function migrate() {
    console.log('Starting migration: NEW STOCK RESERVATION TABLES');

    const tenants = fs.readdirSync(TENANTS_DIR).filter(f => fs.statSync(path.join(TENANTS_DIR, f)).isDirectory());

    for (const tenantId of tenants) {
        console.log(`Migrating tenant: ${tenantId}`);
        const dbPath = path.join(TENANTS_DIR, tenantId, `${tenantId}.db`);

        if (!fs.existsSync(dbPath)) {
            console.warn(`Database not found for ${tenantId}, skipping.`);
            continue;
        }

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        try {
            await db.exec('BEGIN TRANSACTION');

            // 1. Create stock_reservations table
            await db.exec(`
                CREATE TABLE IF NOT EXISTS stock_reservations (
                    reservation_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    
                    demand_id TEXT,
                    demand_line_id TEXT,
                    
                    product_id TEXT NOT NULL,
                    lot TEXT,
                    expiry DATETIME,
                    location_id TEXT NOT NULL,
                    
                    qty_units INTEGER NOT NULL CHECK (qty_units > 0),
                    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, COMMITTED, EXPIRED
                    
                    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    released_at DATETIME,
                    committed_at DATETIME,
                    
                    transfer_id TEXT,
                    transfer_line_id TEXT,
                    
                    client_request_id TEXT
                );
            `);

            // 2. Create Indexes
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_reservations_active 
                ON stock_reservations(tenant_id, location_id, product_id, lot, expiry) 
                WHERE status = 'ACTIVE';
            `);
            
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_reservations_session 
                ON stock_reservations(tenant_id, session_id) 
                WHERE status = 'ACTIVE';
            `);
            
            await db.exec(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_idempotency 
                ON stock_reservations(tenant_id, client_request_id) 
                WHERE client_request_id IS NOT NULL;
            `);
            
            await db.exec('COMMIT');
            console.log(`✅ successfully migrated ${tenantId}`);
        } catch (error) {
            console.error(`❌ Failed to migrate ${tenantId}:`, error);
            await db.exec('ROLLBACK');
        } finally {
            await db.close();
        }
    }
}

migrate();
