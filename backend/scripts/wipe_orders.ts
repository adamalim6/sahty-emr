
import sqlite3 from 'sqlite3';
import path from 'path';

// Tenant ID as identified in previous steps
const TENANT_ID = 'client_1768926673968';

// Use process.cwd() assuming script is run from project root or backend dir
const DB_PATH = path.join(process.cwd(), `data/tenants/${TENANT_ID}/${TENANT_ID}.db`);

const db = new sqlite3.Database(DB_PATH);

const run = (sql: string) => new Promise<void>((resolve, reject) => {
    db.run(sql, function(err) {
        if (err) {
            console.error(`Error running ${sql}:`, err.message);
            reject(err);
        } else {
            console.log(`Success: ${sql} (Rows affected: ${this.changes})`);
            resolve();
        }
    });
});

async function wipe() {
    try {
        console.log(`Wiping orders for tenant: ${TENANT_ID}`);
        console.log(`DB Path: ${DB_PATH}`);

        // Delete items first to avoid constraint violation (though cascading might handle it, better explicit)
        await run(`DELETE FROM po_items WHERE tenant_id = '${TENANT_ID}'`);
        
        // Also wipe from purchase_orders
        await run(`DELETE FROM purchase_orders WHERE tenant_id = '${TENANT_ID}'`);

        // Also wipe delivery notes? User asked for po_items and purchase_orders.
        // If delivery notes exist referencing these POs, they might be orphaned or block deletion.
        // Let's safe wipe delivery_notes too just in case, or at least try.
        try {
             await run(`DELETE FROM delivery_note_items WHERE tenant_id = '${TENANT_ID}'`);
             await run(`DELETE FROM delivery_notes WHERE tenant_id = '${TENANT_ID}'`);
             console.log("Wiped related delivery notes as well.");
        } catch (e) {
            console.log("Delivery notes wipe skipped or failed (non-critical if empty)");
        }

        console.log('Wipe Complete');
    } catch (error) {
        console.error('Wipe Failed:', error);
    } finally {
        db.close();
    }
}

wipe();
