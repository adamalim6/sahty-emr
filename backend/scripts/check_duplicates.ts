
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');
const db = new sqlite3.Database(DB_PATH);
const PRODUCT_ID = '8a194705-29ca-4d4e-8109-c20e077ba39d';

console.log(`--- DUPLICATE CHECK FOR PRODUCT ${PRODUCT_ID} ---`);

console.log(`--- GLOBAL DUPLICATE CHECK ---`);

const q = `
SELECT product_id, supplier_id, count(*) as count
FROM product_suppliers
GROUP BY product_id, supplier_id
HAVING count > 1
LIMIT 10
`;

db.all(q, [], (err, rows) => {
    if (err) { console.error(err); return; }
    console.log('Duplicate Suppliers Found:', JSON.stringify(rows, null, 2));
});
