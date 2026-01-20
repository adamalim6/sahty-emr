
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';


const GLOBAL_DB_PATH = path.join(__dirname, '../data/global/global.db');
// We need to look in backup for the moved files, but users.json is still in data root
const BACKUP_DIR = path.join(__dirname, '../data/legacy_json_backup_1768869054207/global');
const USERS_JSON_PATH = path.join(__dirname, '../data/users.json');

// Check if backup dir exists, if not fall back to global (just in case)
const GLOBAL_DATA_SOURCE = fs.existsSync(BACKUP_DIR) ? BACKUP_DIR : path.join(__dirname, '../data/global');

interface PromisifiedStatement {
    run(...params: any[]): Promise<void>;
    finalize(): Promise<void>;
}

// Promisify sqlite3
function openDb(path: string): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function exec(db: sqlite3.Database, sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function all(db: sqlite3.Database, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function prepare(db: sqlite3.Database, sql: string): Promise<PromisifiedStatement> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql, (err) => {
            if (err) reject(err);
        });
        
        // Wrapper for statement
        const wrapper: PromisifiedStatement = {
            run: (...params: any[]) => new Promise((res, rej) => {
                stmt.run(...params, (err: Error | null) => {
                    if (err) rej(err);
                    else res();
                });
            }),
            finalize: () => new Promise((res, rej) => {
                stmt.finalize((err: Error | null) => {
                    if (err) rej(err);
                    else res();
                });
            })
        };
        resolve(wrapper);
    });
}

function closeDb(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function migrate() {
    console.log(`Opening global DB at ${GLOBAL_DB_PATH}...`);
    const db = await openDb(GLOBAL_DB_PATH);

    try {
        // 1. Create/Update Tables
        console.log("Checking schema...");
        
        await exec(db, `
            CREATE TABLE IF NOT EXISTS global_actes (
                code_sih TEXT PRIMARY KEY,
                famille_sih TEXT,
                sous_famille_sih TEXT,
                libelle_sih TEXT,
                code_ngap TEXT,
                libelle_ngap TEXT,
                cotation_ngap TEXT,
                nature_ngap TEXT,
                code_ccam TEXT,
                libelle_ccam TEXT,
                nature_ccam TEXT,
                duree_moyenne INTEGER,
                type_acte TEXT,
                actif BOOLEAN DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS global_roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                permissions TEXT, -- JSON array
                modules TEXT -- JSON array
            );

            CREATE TABLE IF NOT EXISTS global_atc (
                code TEXT PRIMARY KEY,
                label_fr TEXT,
                label_en TEXT,
                level INTEGER,
                parent_code TEXT
            );

            CREATE TABLE IF NOT EXISTS global_emdn (
                code TEXT PRIMARY KEY,
                label_fr TEXT,
                label_en TEXT,
                level INTEGER,
                parent_code TEXT
            );
        `);
        
        // Check global_suppliers columns
        const suppliersColumns: any[] = await all(db, "PRAGMA table_info(global_suppliers)");
        const hasIsActive = suppliersColumns.some((c: any) => c.name === 'is_active');
        if (!hasIsActive && suppliersColumns.length > 0) {
             console.log("Adding is_active to global_suppliers...");
             await run(db, "ALTER TABLE global_suppliers ADD COLUMN is_active BOOLEAN DEFAULT 1");
        }

        // Check users columns for client_id
        const usersColumns: any[] = await all(db, "PRAGMA table_info(users)");
        const hasClientId = usersColumns.some((c: any) => c.name === 'client_id');
        if (!hasClientId && usersColumns.length > 0) {
             console.log("Adding client_id to users...");
             await run(db, "ALTER TABLE users ADD COLUMN client_id TEXT");
        }

        // 2. Migrate Users
        if (fs.existsSync(USERS_JSON_PATH)) {
            console.log("Migrating Users from users.json...");
            const users: any[] = JSON.parse(fs.readFileSync(USERS_JSON_PATH, 'utf-8'));
            const stmt = await prepare(db, `
                INSERT OR REPLACE INTO users (id, username, password_hash, nom, prenom, user_type, role_code, client_id, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `);
            
            await run(db, "BEGIN TRANSACTION");
            for (const u of users) {
                // Determine role_code from role_id if needed, or mapping
                // JSON: role_id: "role_admin_struct"
                // DB: role_code
                // We'll use role_id as role_code
                await stmt.run(
                    u.id, 
                    u.username, 
                    u.password_hash, 
                    u.nom, 
                    u.prenom, 
                    u.user_type, 
                    u.role_id, 
                    u.client_id
                );
            }
            await run(db, "COMMIT");
            await stmt.finalize();
            console.log(`Migrated ${users.length} users.`);
        }

        // 3. Migrate Actes (from Backup/Source)
        if (fs.existsSync(path.join(GLOBAL_DATA_SOURCE, 'actes.json'))) {
            // Only migrate if table is empty to avoid redundant work? 
            // Or Replace to be safe. Replace is safe.
            const countRow: any = await all(db, "SELECT count(*) as c FROM global_actes");
            if (countRow[0].c === 0) {
                console.log("Migrating Actes...");
                const rawActes = fs.readFileSync(path.join(GLOBAL_DATA_SOURCE, 'actes.json'), 'utf-8');
                const actes: any[] = JSON.parse(rawActes);
                
                const stmt = await prepare(db, `
                    INSERT OR REPLACE INTO global_actes (
                        code_sih, famille_sih, sous_famille_sih, libelle_sih,
                        code_ngap, libelle_ngap, cotation_ngap, nature_ngap,
                        code_ccam, libelle_ccam, nature_ccam,
                        duree_moyenne, type_acte, actif
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                await run(db, "BEGIN TRANSACTION");
                for (const a of actes) {
                    await stmt.run(
                        a["Code SIH"], a["Famille SIH"], a["Sous-famille SIH"], a["Libellé SIH"],
                        a["Code NGAP correspondant"], a["Libellé NGAP correspondant"], a["Cotation NGAP"], a["Nature de la correspondance NGAP"],
                        a["Code CCAM correspondant"], a["Libellé CCAM correspondant"], a["Nature de la correspondance CCAM"],
                        a["Durée moyenne en minutes"], a["Type d'acte"], a["Actif"]
                    );
                }
                await run(db, "COMMIT");
                await stmt.finalize();
                console.log(`Migrated ${actes.length} actes.`);
            } else {
                console.log(`Skipping Actes (Already has ${countRow[0].c} rows)`);
            }
        }

        // 4. Migrate Roles (from Backup/Source)
        if (fs.existsSync(path.join(GLOBAL_DATA_SOURCE, 'roles.json'))) {
             const countRow: any = await all(db, "SELECT count(*) as c FROM global_roles");
             if (countRow[0].c === 0) {
                console.log("Migrating Roles...");
                const roles: any[] = JSON.parse(fs.readFileSync(path.join(GLOBAL_DATA_SOURCE, 'roles.json'), 'utf-8'));
                const stmt = await prepare(db, `
                    INSERT OR REPLACE INTO global_roles (id, name, description, permissions, modules)
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                await run(db, "BEGIN TRANSACTION");
                for (const r of roles) {
                    await stmt.run(
                        r.id, r.name, r.description || '',
                        JSON.stringify(r.permissions),
                        JSON.stringify(r.modules || [])
                    );
                }
                await run(db, "COMMIT");
                await stmt.finalize();
                console.log(`Migrated ${roles.length} roles.`);
            } else {
                 console.log(`Skipping Roles (Already has ${countRow[0].c} rows)`);
            }
        }

        // 5. Migrate Suppliers (from Backup/Source)
        if (fs.existsSync(path.join(GLOBAL_DATA_SOURCE, 'suppliers.json'))) {
             const countRow: any = await all(db, "SELECT count(*) as c FROM global_suppliers");
             // Suppliers table might have existed before, so check if new data needs to be added? 
             // We'll just upsert if we want to be sure, but to save time check count.
             // Actually, 55 rows is small, just upsert.
             if (true) {
                console.log("Refining Suppliers...");
                const suppliers: any[] = JSON.parse(fs.readFileSync(path.join(GLOBAL_DATA_SOURCE, 'suppliers.json'), 'utf-8'));
                const stmt = await prepare(db, `
                    INSERT OR REPLACE INTO global_suppliers (id, name, is_active, created_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                await run(db, "BEGIN TRANSACTION");
                for (const s of suppliers) {
                    await stmt.run(s.id, s.name, s.is_active, s.created_at);
                }
                await run(db, "COMMIT");
                await stmt.finalize();
                console.log(`Migrated ${suppliers.length} suppliers.`);
             }
        }

        // 6. Migrate Tree Data
        async function insertTree(items: any[], table: string, pCode: string | null = null) {
            const stmt = await prepare(db, `
                INSERT OR REPLACE INTO ${table} (code, label_fr, label_en, level, parent_code)
                VALUES (?, ?, ?, ?, ?)
            `); 
            
            let count = 0;
            const stack: { item: any, parent: string | null }[] = items.map(i => ({ item: i, parent: pCode }));
            
            await run(db, "BEGIN TRANSACTION");
            while (stack.length > 0) {
                const { item, parent } = stack.pop()!;
                await stmt.run(item.code, item.label_fr, item.label_en, item.level, parent);
                count++;
                
                if (item.children && item.children.length > 0) {
                    for (const child of item.children) {
                        stack.push({ item: child, parent: item.code });
                    }
                }
            }
            await run(db, "COMMIT");
            await stmt.finalize();
            return count;
        }

        if (fs.existsSync(path.join(GLOBAL_DATA_SOURCE, 'atc_tree.json'))) {
             const countRow: any = await all(db, "SELECT count(*) as c FROM global_atc");
             if (countRow[0].c === 0) {
                console.log("Migrating ATC Tree...");
                const atcTree = JSON.parse(fs.readFileSync(path.join(GLOBAL_DATA_SOURCE, 'atc_tree.json'), 'utf-8'));
                const count = await insertTree(atcTree, 'global_atc');
                console.log(`Migrated ${count} ATC codes.`);
             } else {
                 console.log(`Skipping ATC (Already has ${countRow[0].c} rows)`);
             }
        }

        if (fs.existsSync(path.join(GLOBAL_DATA_SOURCE, 'emdn_tree.json'))) {
             const countRow: any = await all(db, "SELECT count(*) as c FROM global_emdn");
             if (countRow[0].c === 0) {
                console.log("Migrating EMDN Tree...");
                const emdnTree = JSON.parse(fs.readFileSync(path.join(GLOBAL_DATA_SOURCE, 'emdn_tree.json'), 'utf-8'));
                const count = await insertTree(emdnTree, 'global_emdn');
                console.log(`Migrated ${count} EMDN codes.`);
             } else {
                 console.log(`Skipping EMDN (Already has ${countRow[0].c} rows)`);
             }
        }

        console.log("Migration finished successfully.");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await closeDb(db);
    }
}

migrate();

