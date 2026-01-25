
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');
const db = new sqlite3.Database(DB_PATH);
const PRODUCT_ID = '8a194705-29ca-4d4e-8109-c20e077ba39d';
const SUPPLIER_ID = 'supp_1';

console.log(`--- CLEANUP DUPLICATES FOR ${PRODUCT_ID} | ${SUPPLIER_ID} ---`);

// 1. Find all links
db.all(`SELECT id, created_at, is_active FROM product_suppliers WHERE product_id = ? AND supplier_id = ? ORDER BY created_at DESC`, [PRODUCT_ID, SUPPLIER_ID], (err, rows) => {
    if (err) { console.error(err); return; }
    
    if (rows.length <= 1) {
        console.log('No duplicates to clean.');
        return;
    }

    // Keep the first one (most recent), delete others
    const keep = rows[0];
    const toDelete = rows.slice(1);
    
    console.log(`KEEPING: ${keep.id} (${keep.created_at})`);
    console.log(`DELETING: ${toDelete.length} rows`);

    const ids = toDelete.map(r => `'${r.id}'`).join(',');
    
    db.run(`DELETE FROM product_suppliers WHERE id IN (${ids})`, [], (e) => {
        if (e) console.error('Delete failed:', e);
        else console.log('Cleanup successful.');
    });
});
