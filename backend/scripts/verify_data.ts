
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');

const db = new sqlite3.Database(DB_PATH);

db.all(`SELECT * FROM product_price_versions`, [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('--- CONTENTS OF product_price_versions IN client_1768926673968 ---');
    console.log(JSON.stringify(rows, null, 2));
    console.log('-------------------------------------------------------------------');
    
    db.all(`SELECT * FROM product_suppliers`, [], (err, rows2) => {
         console.log('--- CONTENTS OF product_suppliers IN client_1768926673968 ---');
         console.log(JSON.stringify(rows2, null, 2));
         console.log('--------------------------------------------------------------');
    });
});
