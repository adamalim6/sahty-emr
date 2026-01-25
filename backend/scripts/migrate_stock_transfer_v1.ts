import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

// Define paths
const TENANTS_DIR = path.resolve(__dirname, '../data/tenants');
const MIGRATION_NAME = 'migrate_stock_transfer_v1';

// Enable verbose mode for debugging
const sqlite = sqlite3.verbose();

function runQuery(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
}

function getQuery(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function allQuery(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function migrateTenant(tenantId: string, dbPath: string) {
    console.log(`[${tenantId}] Starting migration: ${MIGRATION_NAME}`);
    
    if (!fs.existsSync(dbPath)) {
        console.error(`[${tenantId}] Database not found at ${dbPath}`);
        return;
    }

    const db = new sqlite.Database(dbPath);

    try {
        // Wrap entire logic in a promise to ensure db.close() runs after
        await new Promise<void>(async (resolve, reject) => {
            try {
                 // 1. Rename Tables (Intent Layer)
                const checkRequests = await getQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='replenishment_requests'");
                if (checkRequests) {
                    console.log(`[${tenantId}] Renaming replenishment_requests -> stock_demands`);
                    await runQuery(db, "ALTER TABLE replenishment_requests RENAME TO stock_demands");
                }

                const checkItems = await getQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='replenishment_items'");
                if (checkItems) {
                    console.log(`[${tenantId}] Renaming replenishment_items -> stock_demand_lines`);
                    await runQuery(db, "ALTER TABLE replenishment_items RENAME TO stock_demand_lines");
                }

                // 2. Adjust Columns for `stock_demands`
                const tableInfo = await allQuery(db, "PRAGMA table_info(stock_demands)");
                const hasPriority = tableInfo.some((c: any) => c.name === 'priority');
                
                if (!hasPriority) {
                    console.log(`[${tenantId}] Adding 'priority' to stock_demands`);
                    await runQuery(db, "ALTER TABLE stock_demands ADD COLUMN priority TEXT DEFAULT 'ROUTINE'");
                }

                // 2.1 Adjust Columns for `stock_demand_lines`
                const linesInfo = await allQuery(db, "PRAGMA table_info(stock_demand_lines)");
                const hasQtyApproved = linesInfo.some((c: any) => c.name === 'qty_approved');
                
                if (!hasQtyApproved) {
                    console.log(`[${tenantId}] Adding 'qty_approved' to stock_demand_lines`);
                    await runQuery(db, "ALTER TABLE stock_demand_lines ADD COLUMN qty_approved INTEGER");
                }

                // 3. Create Execution Layer Tables
                console.log(`[${tenantId}] Creating stock_transfers table`);
                await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS stock_transfers (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        demand_id TEXT,
                        source_location_id TEXT NOT NULL,
                        destination_location_id TEXT NOT NULL,
                        status TEXT DEFAULT 'PENDING',
                        validated_at DATETIME,
                        validated_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (demand_id) REFERENCES stock_demands(request_id)
                    )
                `);

                console.log(`[${tenantId}] Creating stock_transfer_lines table`);
                await runQuery(db, `
                    CREATE TABLE IF NOT EXISTS stock_transfer_lines (
                        id TEXT PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        transfer_id TEXT NOT NULL,
                        product_id TEXT NOT NULL,
                        lot TEXT NOT NULL,
                        expiry DATE NOT NULL,
                        qty_transferred INTEGER NOT NULL,
                        demand_line_id TEXT,
                        FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id)
                    )
                `);
                
                // 4. Create Indexes
                await runQuery(db, "CREATE INDEX IF NOT EXISTS idx_st_tenant ON stock_transfers(tenant_id)");
                await runQuery(db, "CREATE INDEX IF NOT EXISTS idx_st_demand ON stock_transfers(demand_id)");
                await runQuery(db, "CREATE INDEX IF NOT EXISTS idx_stl_transfer ON stock_transfer_lines(transfer_id)");

                console.log(`[${tenantId}] Migration successful`);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    } catch (err) {
        console.error(`[${tenantId}] Migration failed:`, err);
    } finally {
        db.close();
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const specificTenant = args[0]; // Optional: run for specific tenant

    const tenants = fs.readdirSync(TENANTS_DIR).filter(file => {
        return fs.statSync(path.join(TENANTS_DIR, file)).isDirectory() && file.startsWith('client_');
    });

    for (const tenantId of tenants) {
        if (specificTenant && tenantId !== specificTenant) continue;

        const dbPath = path.join(TENANTS_DIR, tenantId, `${tenantId}.db`);
        await migrateTenant(tenantId, dbPath);
    }
}

main();
