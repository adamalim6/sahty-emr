
import fs from 'fs';
import path from 'path';
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, '../data/tenants');

// Helper wrapper for sqlite3
class AsyncDatabase {
    db: any;

    constructor(dbPath: string) {
        this.db = new sqlite3.Database(dbPath);
    }

    exec(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    all(sql: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, [], (err: any, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// Helper to get SQLite DB
async function getTenantDB(tenantId: string): Promise<any> {
    const dbPath = path.join(DATA_DIR, tenantId, `${tenantId}.db`);
    return new AsyncDatabase(dbPath);
}

function getAllTenants(): string[] {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'GLOBAL')
        .map(d => d.name);
}

async function migrate() {
    console.log('Starting Migration: Remove Supplier ID (Native SQLite3)...');
    const tenants = getAllTenants();

    for (const tenantId of tenants) {
        console.log(`Migrating Tenant: ${tenantId}...`);
        const db = await getTenantDB(tenantId);
        
        try {
            // No strict BEGIN TRANSACTION needed for DDL in sqlite3 wrapper usually, 
            // but we can try exec-ing it. 
            // Note: sqlite3 exec runs multiple buffer statements.
            
            // --- 1. CURRENT STOCK ---
            const stockInfo = await db.all("PRAGMA table_info(current_stock)");
            const stockHasSupplier = stockInfo.some((col: any) => col.name === 'supplier_id');

            if (stockHasSupplier) {
                console.log(`  - Migrating current_stock...`);
                await db.exec('BEGIN TRANSACTION;');
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS current_stock_new (
                        tenant_id TEXT NOT NULL,
                        product_id TEXT NOT NULL,
                        lot TEXT NOT NULL,
                        expiry DATE NOT NULL,
                        location TEXT NOT NULL,
                        qty_units INTEGER NOT NULL,
                        PRIMARY KEY (tenant_id, product_id, lot, location)
                    );
                    INSERT INTO current_stock_new (tenant_id, product_id, lot, expiry, location, qty_units)
                    SELECT tenant_id, product_id, lot, expiry, location, qty_units FROM current_stock;
                    DROP TABLE current_stock;
                    ALTER TABLE current_stock_new RENAME TO current_stock;
                    CREATE INDEX IF NOT EXISTS idx_stock_loc ON current_stock(tenant_id, location);
                    CREATE INDEX IF NOT EXISTS idx_stock_prod ON current_stock(tenant_id, product_id);
                `);
                await db.exec('COMMIT;');
            } else {
                console.log(`  - current_stock already migrated.`);
            }

            // --- 2. INVENTORY MOVEMENTS ---
            const movInfo = await db.all("PRAGMA table_info(inventory_movements)");
            const movHasSupplier = movInfo.some((col: any) => col.name === 'supplier_id');

            if (movHasSupplier) {
                console.log(`  - Migrating inventory_movements...`);
                await db.exec('BEGIN TRANSACTION;');
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS inventory_movements_new (
                        movement_id TEXT PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        product_id TEXT NOT NULL,
                        lot TEXT NOT NULL,
                        expiry DATE NOT NULL,
                        qty_units INTEGER NOT NULL,
                        from_location TEXT,
                        to_location TEXT,
                        document_type TEXT NOT NULL,
                        document_id TEXT,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                    INSERT INTO inventory_movements_new (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, document_type, document_id, created_by, created_at
                    )
                    SELECT 
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, document_type, document_id, created_by, created_at 
                    FROM inventory_movements;
                    DROP TABLE inventory_movements;
                    ALTER TABLE inventory_movements_new RENAME TO inventory_movements;
                    
                    CREATE INDEX IF NOT EXISTS idx_mov_tenant ON inventory_movements(tenant_id);
                    CREATE INDEX IF NOT EXISTS idx_mov_prod_lot_exp ON inventory_movements(tenant_id, product_id, lot, expiry);
                    CREATE INDEX IF NOT EXISTS idx_mov_doc ON inventory_movements(tenant_id, document_type, document_id);
                `);
                await db.exec('COMMIT;');
            } else {
                console.log(`  - inventory_movements already migrated.`);
            }

            console.log(`  - Success.`);
        } catch (error) {
            console.error(`  - Failed to migrate ${tenantId}:`, error);
            try { await db.exec('ROLLBACK;'); } catch (e) {} 
        } finally {
            await db.close();
        }
    }

    console.log('Migration Complete.');
}

migrate().catch(console.error);
