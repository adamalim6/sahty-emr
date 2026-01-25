
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/global/global.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log("--- GLOBAL DB CHECK ---");
    db.all("SELECT * FROM global_suppliers LIMIT 10", (err, rows) => {
        if (err) console.error("Global Suppliers Error:", err);
        else console.log("Global Suppliers:", rows);
    });
});

db.close();
