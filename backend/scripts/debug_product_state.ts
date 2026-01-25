
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');
const db = new sqlite3.Database(DB_PATH);
const PRODUCT_ID = '8a194705-29ca-4d4e-8109-c20e077ba39d';

console.log(`--- DEBUG STATE FOR PRODUCT ${PRODUCT_ID} ---`);

const q1 = `
SELECT * FROM product_suppliers 
WHERE product_id = '${PRODUCT_ID}'
`;

db.all(q1, [], (err, suppliers) => {
    if (err) { console.error(err); return; }
    console.log('SUPPLIERS:', JSON.stringify(suppliers, null, 2));
    
    suppliers.forEach((s: any) => {
        const q2 = `
        SELECT * FROM product_price_versions 
        WHERE product_supplier_id = '${s.id}'
        ORDER BY valid_from DESC
        `;
        db.all(q2, [], (e, prices) => {
            if (e) console.error('ERROR FETCHING PRICES:', e);
            console.log(`PRICES FOR LINK ${s.id} (${s.supplier_id}):`, JSON.stringify(prices, null, 2));
        });
    });
});
