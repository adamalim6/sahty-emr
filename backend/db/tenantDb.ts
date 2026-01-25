import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const TENANTS_DIR = path.join(__dirname, '../data/tenants');

// Cache connections to avoid opening too many file handles? 
// Or open/close on demand? 
// Keeping them open is faster but consumes FDs.
// Nodes default ulimit is high enough for reasonable tenant count. 
// Let's cache for now.
const connections: { [key: string]: sqlite3.Database } = {};

const ensureDirectory = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

export const getTenantDB = (tenantId: string): Promise<sqlite3.Database> => {
    return new Promise((resolve, reject) => {
        if (connections[tenantId]) {
            return resolve(connections[tenantId]);
        }

        const tenantDir = path.join(TENANTS_DIR, tenantId);
        ensureDirectory(tenantDir); // Ensure directory exists
        // For pharmacy specifically, maybe put in pharmacy subdir?
        // User said "file per tenant". "tenants/client_.../pharmacy.sqlite" or "tenants/client_.../pharmacy/store.sqlite"?
        // MIGRATION: Use <tenantId>.db at root of tenant folder
        const dbPath = path.join(tenantDir, `${tenantId}.db`);
        const pharmacyDir = path.join(tenantDir, 'pharmacy');
        const legacyPath = path.join(pharmacyDir, 'pharmacy.sqlite');

        // Auto-migrate legacy pharmacy DB if it exists and new DB doesn't
        if (fs.existsSync(legacyPath) && !fs.existsSync(dbPath)) {
            console.log(`[DB] Migrating legacy pharmacy.sqlite to ${tenantId}.db`);
            // Ensure target directory exists (tenantDir) - already done?
            // fs.renameSync(legacyPath, dbPath);
             try {
                fs.renameSync(legacyPath, dbPath);
            } catch (e) {
                console.error("Failed to move legacy DB:", e);
            }
        }
        
        // Ensure legacy pharmacy dir exists if we still use it for other things (optional)

        
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            
            // Apply Schema
            if (fs.existsSync(SCHEMA_PATH)) {
                const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
                db.exec(schema, (err) => {
                    if (err) {
                        console.error(`[DB] Error applying schema for ${tenantId}:`, err);
                        return reject(err);
                    }
                    connections[tenantId] = db;
                    resolve(db);
                });
            } else {
                console.warn("[DB] Schema file not found, skipping init.");
                connections[tenantId] = db;
                resolve(db);
            }
        });
    });
};

export const run = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve();
        });
    });
};

export const get = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

export const all = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};
