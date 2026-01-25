
import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/tenants/client_1768926673968/client_1768926673968.db');

const db = new sqlite3.Database(DB_PATH);

const run = (sql: string) => new Promise<void>((resolve, reject) => {
    db.run(sql, function(err) {
        if (err) {
            // Ignore "duplicate column" errors if re-running
            if (err.message.includes('duplicate column')) {
                console.log(`Skipping duplicate column: ${sql.substring(0, 50)}...`);
                resolve();
            } else if (err.message.includes('already exists')) {
                 console.log(`Skipping existing table: ${sql.substring(0, 50)}...`);
                 resolve();
            } else {
                console.error(`Error running ${sql}:`, err.message);
                // resolve(); // Proceed anyway?
                reject(err);
            }
        } else {
            console.log(`Success: ${sql.substring(0, 50)}...`);
            resolve();
        }
    });
});

async function migrate() {
    try {
        console.log('Migrating Tenant DB:', DB_PATH);

        // 1. Update product_configs
        try {
            await run(`ALTER TABLE product_configs ADD COLUMN security_stock INTEGER DEFAULT 0`);
        } catch (e) { console.log('security_stock likely exists'); }

        // 2. Update product_suppliers
        // Old schema probably: tenant_id, product_id, supplier_id, ...
        // New schema needs: id, supplier_type, is_active
        
        try {
            await run(`ALTER TABLE product_suppliers ADD COLUMN id TEXT`);
            // Generate IDs for existing rows?
            // "UPDATE product_suppliers SET id = hex(randomblob(16)) WHERE id IS NULL"
            await run(`UPDATE product_suppliers SET id = lower(hex(randomblob(16))) WHERE id IS NULL`);
        } catch (e) { console.log('id column likely exists'); }

        try {
            await run(`ALTER TABLE product_suppliers ADD COLUMN supplier_type TEXT DEFAULT 'GLOBAL'`);
        } catch (e) { console.log('supplier_type likely exists'); }

        try {
            await run(`ALTER TABLE product_suppliers ADD COLUMN is_active BOOLEAN DEFAULT 1`);
        } catch (e) { console.log('is_active likely exists'); }

        // 3. Create product_price_versions
        await run(`
            CREATE TABLE IF NOT EXISTS product_price_versions (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                product_supplier_id TEXT NOT NULL,
                purchase_price NUMERIC(12,4) NOT NULL,
                margin NUMERIC(12,4) DEFAULT 0,
                vat NUMERIC(5,2) DEFAULT 0,
                sale_price_ht NUMERIC(12,4),
                sale_price_ttc NUMERIC(12,4),
                valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
                valid_to DATETIME,
                created_by TEXT,
                FOREIGN KEY (product_supplier_id) REFERENCES product_suppliers(id)
            )
        `);
        
        await run(`CREATE INDEX IF NOT EXISTS idx_price_ver_supp ON product_price_versions(product_supplier_id)`);

        console.log('Migration Complete');
    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        db.close();
    }
}

migrate();
