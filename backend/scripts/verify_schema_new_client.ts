
const { Database } = require('sqlite3');
const path = require('path');
const fs = require('fs');

async function main() {
    const dbPath = path.join(process.cwd(), 'backend/data', `verification_new_client_${Date.now()}.db`);
    const schemaPath = path.join(process.cwd(), 'backend/db/schema.sql');

    console.log(`Creating new DB at: ${dbPath}`);
    
    // 1. Create DB
    const db = new Database(dbPath);
    
    // 2. Apply Schema
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log("Schema applied successfully.");
        
        // 3. Verify Columns
        const getColumns = (table) => new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(${table})`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Verify po_items
        const poItemsCols = await getColumns('po_items');
        const hasQtyDelivered = poItemsCols.some(c => c.name === 'qty_delivered');
        const hasQtyToBeDelivered = poItemsCols.some(c => c.name === 'qty_to_be_delivered');
        
        console.log("\nTable: po_items");
        console.log("- qty_delivered:", hasQtyDelivered ? "✅ FOUND" : "❌ MISSING");
        console.log("- qty_to_be_delivered:", hasQtyToBeDelivered ? "✅ FOUND" : "❌ MISSING");

        // Verify delivery_notes (formerly purchase_receipts)
        const notesCols = await getColumns('delivery_notes');
        const hasPoId = notesCols.some(c => c.name === 'po_id');
        const hasNoteId = notesCols.some(c => c.name === 'delivery_note_id');
        
        console.log("\nTable: delivery_notes");
        console.log("- table exists:", notesCols.length > 0 ? "✅ YES" : "❌ NO");
        console.log("- po_id:", hasPoId ? "✅ FOUND" : "❌ MISSING");
        console.log("- delivery_note_id:", hasNoteId ? "✅ FOUND" : "❌ MISSING (Did you rename receipt_id?)");

        // Verify delivery_note_items (formerly purchase_receipt_items)
        const itemsCols = await getColumns('delivery_note_items');
        const hasItemsNoteId = itemsCols.some(c => c.name === 'delivery_note_id');
        console.log("\nTable: delivery_note_items");
        console.log("- table exists:", itemsCols.length > 0 ? "✅ YES" : "❌ NO");
        console.log("- delivery_note_id:", hasItemsNoteId ? "✅ FOUND" : "❌ MISSING");


        if (!hasQtyDelivered || !hasQtyToBeDelivered || !hasPoId || !hasNoteId) {
            throw new Error("Validation Failed: New columns or renamed tables missing in Fresh DB!");
        }
        
    } catch (err) {
        console.error("Verification Failed:", err);
    } finally {
        db.close();
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
}

main();
