
const { Database } = require('sqlite3');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const glob = require('glob');

async function main() {
    console.log("--- Starting Migration for All Tenants ---");

    const tenantsDir = path.join(process.cwd(), 'backend/data/tenants');
    // Find all .db files recursively in tenants dir
    // Pattern: tenants/client_.../client_...db
    
    // Using manual directory scan since glob might not be installed or configured easily here
    // We know structure: tenants/<id>/<id>.db
    
    if (!fs.existsSync(tenantsDir)) {
        console.error("Tenants directory found!");
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
        await runQuery(db, "ALTER TABLE purchase_receipts ADD COLUMN po_id TEXT");
        console.log("  - Added po_id to purchase_receipts");
    } catch (e) {
        if (e.message.includes('duplicate column')) {
             console.log("  - po_id already exists (Skipped)");
        } else {
             console.log("  - Error adding po_id:", e.message);
        }
    }

    try {
        await runQuery(db, "ALTER TABLE po_items ADD COLUMN qty_delivered INTEGER DEFAULT 0");
        console.log("  - Added qty_delivered to po_items");
    } catch (e) {
        if (e.message.includes('duplicate column')) {
             console.log("  - qty_delivered already exists (Skipped)");
        } else {
             console.log("  - Error adding qty_delivered:", e.message);
        }
    }

    try {
        await runQuery(db, "ALTER TABLE po_items ADD COLUMN qty_to_be_delivered INTEGER DEFAULT 0");
        console.log("  - Added qty_to_be_delivered to po_items");
    } catch (e) {
        if (e.message.includes('duplicate column')) {
             console.log("  - qty_to_be_delivered already exists (Skipped)");
        } else {
             console.log("  - Error adding qty_to_be_delivered:", e.message);
        }
    }
    
    db.close();
}

function runQuery(db, query) {
    return new Promise((resolve, reject) => {
        db.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

main();
