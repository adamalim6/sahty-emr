
import { getGlobalDB } from '../db/globalDb';
import fs from 'fs';
import path from 'path';

async function diagnose() {
    console.log("=== SUPERADMIN DATA DIAGNOSTIC ===");
    
    // 1. Check ATC Tree File
    const atcPath = path.join(__dirname, '../data/global/atc_tree.json');
    console.log(`\n[ATC Tree] Checking path: ${atcPath}`);
    if (fs.existsSync(atcPath)) {
        const stats = fs.statSync(atcPath);
        console.log(`✅ ATC Tree found (${stats.size} bytes)`);
    } else {
        console.error(`❌ ATC Tree NOT FOUND at ${atcPath}`);
    }

    // 2. Check Global DB Tables
    console.log("\n[Global DB] Checking table counts...");
    const db = await getGlobalDB();
    
    try {
        const dciCount = await new Promise((resolve, reject) => {
            db.get("SELECT Count(*) as count FROM global_dci", (err, row: any) => err ? reject(err) : resolve(row.count));
        });
        console.log(`${dciCount ? '✅' : '❌'} DCI Table (global_dci): ${dciCount} rows`);
        
        const actesCount = await new Promise((resolve, reject) => {
            db.get("SELECT Count(*) as count FROM global_actes", (err, row: any) => err ? reject(err) : resolve(row.count));
        });
        console.log(`${actesCount ? '✅' : '❌'} Actes Table (global_actes): ${actesCount} rows`);

        const suppliersCount = await new Promise((resolve, reject) => {
            db.get("SELECT Count(*) as count FROM global_suppliers", (err, row: any) => err ? reject(err) : resolve(row.count));
        });
        console.log(`${suppliersCount ? '✅' : '❌'} Suppliers Table (global_suppliers): ${suppliersCount} rows`);

        // 3. Check Supplier Activation
        console.log("\n[Suppliers] Checking activation status...");
        const activeSuppliers = await new Promise((resolve, reject) => {
           db.get("SELECT Count(*) as count FROM global_suppliers WHERE is_active = 1 OR is_active = 'true'", (err, row: any) => err ? reject(err) : resolve(row.count));
        });
         console.log(`ℹ️ Active Suppliers: ${activeSuppliers} / ${suppliersCount}`);
         
         const sampleSupplier = await new Promise((resolve, reject) => {
             db.get("SELECT * FROM global_suppliers LIMIT 1", (err, row: any) => err ? reject(err) : resolve(row));
         });
         console.log("Sample Supplier:", sampleSupplier);

    } catch (err) {
        console.error("❌ DB Query Failed:", err);
    }
}

diagnose().catch(console.error);
