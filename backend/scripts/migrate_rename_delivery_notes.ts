const { Database } = require('sqlite3');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log("--- Starting Renaming Migration for All Tenants ---");

    const tenantsDir = path.join(process.cwd(), 'backend/data/tenants');
    
    if (!fs.existsSync(tenantsDir)) {
        console.error("Tenants directory not found at:", tenantsDir);
        return;
    }

    const tenantFolders = fs.readdirSync(tenantsDir);
    
    for (const folder of tenantFolders) {
        const dbPath = path.join(tenantsDir, folder, `${folder}.db`);
        
        if (fs.existsSync(dbPath)) {
            console.log(`Migrating: ${folder}...`);
            await migrateDB(dbPath);
        }
    }
    
    console.log("--- Migration Complete ---");
}

async function migrateDB(dbPath) {
    const db = new Database(dbPath);
    
    try {
        // 1. purchase_receipts -> delivery_notes
        if (await tableExists(db, 'purchase_receipts')) {
             await runQuery(db, "ALTER TABLE purchase_receipts RENAME TO delivery_notes");
             console.log("  - Renamed purchase_receipts -> delivery_notes");
        }
        
        // 2. purchase_receipt_items -> delivery_note_items
        if (await tableExists(db, 'purchase_receipt_items')) {
             await runQuery(db, "ALTER TABLE purchase_receipt_items RENAME TO delivery_note_items");
             console.log("  - Renamed purchase_receipt_items -> delivery_note_items");
        }

        // 3. receipt_layers -> delivery_note_layers
        if (await tableExists(db, 'receipt_layers')) {
             await runQuery(db, "ALTER TABLE receipt_layers RENAME TO delivery_note_layers");
             console.log("  - Renamed receipt_layers -> delivery_note_layers");
        }

        // 4. Rename Columns
        // delivery_notes
        if (await tableExists(db, 'delivery_notes') && await columnExists(db, 'delivery_notes', 'receipt_id')) {
             await runQuery(db, "ALTER TABLE delivery_notes RENAME COLUMN receipt_id TO delivery_note_id");
             console.log("  - Renamed delivery_notes.receipt_id -> delivery_note_id");
        }
        
        // delivery_note_items
        if (await tableExists(db, 'delivery_note_items') && await columnExists(db, 'delivery_note_items', 'receipt_id')) {
             await runQuery(db, "ALTER TABLE delivery_note_items RENAME COLUMN receipt_id TO delivery_note_id");
             console.log("  - Renamed delivery_note_items.receipt_id -> delivery_note_id");
        }

        // delivery_note_layers
        if (await tableExists(db, 'delivery_note_layers') && await columnExists(db, 'delivery_note_layers', 'receipt_id')) {
             await runQuery(db, "ALTER TABLE delivery_note_layers RENAME COLUMN receipt_id TO delivery_note_id");
             console.log("  - Renamed delivery_note_layers.receipt_id -> delivery_note_id");
        }

    } catch (e) {
        console.error("  - Migration Error:", e.message);
    } // Continue even if error
    
    // Close DB
    await new Promise((resolve) => db.close(resolve));
}

function runQuery(db, query) {
    return new Promise((resolve, reject) => {
        db.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function tableExists(db, tableName) {
    return new Promise((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

function columnExists(db, tableName, colName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
             if (err) reject(err);
             else {
                 const exists = rows.some(r => r.name === colName);
                 resolve(exists);
             }
        });
    });
}

main();
