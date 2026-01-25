
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/tenants/client_1768926673968/client_1768926673968.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log("--- DB DIRECT CHECK ---");
    
    db.all("SELECT count(*) as c FROM suppliers", (err, rows) => {
        if (err) console.error("Suppliers Error:", err);
        else console.log("Suppliers Count:", rows[0].c);
    });

    db.all("SELECT * FROM suppliers LIMIT 5", (err, rows) => {
        if (err) console.error("Suppliers List Error:", err);
        else console.log("Suppliers List:", rows);
    });

    db.all("SELECT count(*) as c FROM product_suppliers", (err, rows) => {
        if (err) console.error("Product Suppliers Error:", err);
        else console.log("Product Suppliers Links Count:", rows[0].c);
    });
    
    db.all("SELECT * FROM product_suppliers LIMIT 5", (err, rows) => {
         if (err) console.error("Links List Error:", err);
         else console.log("Links List:", rows);
    });
});

db.close();
