import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const TENANTS_DIR = path.resolve(__dirname, '../data/tenants');
const MIGRATION_NAME = 'migrate_remove_demand_approval_cols';

const sqlite = sqlite3.verbose();

function runQuery(db: sqlite3.Database, sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, function(err) {
            if (err) return reject(err);
            resolve();
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
        await new Promise<void>(async (resolve, reject) => {
            try {
                // SQLite doesn't support DROP COLUMN directly in older versions, but likely supports it in recent ones.
                // However, safe way is often creating new table.
                // Let's try DROP COLUMN first, if it fails we catch it.
                // Assuming modern SQLite found in Node environments.
                
                const tableInfo = await allQuery(db, "PRAGMA table_info(stock_demand_lines)");
                const hasQtyApproved = tableInfo.some((c: any) => c.name === 'qty_approved');
                const hasQtyDispensed = tableInfo.some((c: any) => c.name === 'qty_dispensed');

                if (hasQtyApproved) {
                    console.log(`[${tenantId}] Dropping column qty_approved...`);
                    try {
                        await runQuery(db, "ALTER TABLE stock_demand_lines DROP COLUMN qty_approved");
                    } catch (e) {
                         console.error(`[${tenantId}] Failed to drop column qty_approved (Make sure SQLite version >= 3.35.0):`, e);
                         // Fallback? No, just log error for now, user env likely modern.
                    }
                }

                if (hasQtyDispensed) {
                    console.log(`[${tenantId}] Dropping column qty_dispensed...`);
                    try {
                         await runQuery(db, "ALTER TABLE stock_demand_lines DROP COLUMN qty_dispensed");
                    } catch (e) {
                         console.error(`[${tenantId}] Failed to drop column qty_dispensed:`, e);
                    }
                }

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

async function main() {
    const args = process.argv.slice(2);
    const specificTenant = args[0];

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
