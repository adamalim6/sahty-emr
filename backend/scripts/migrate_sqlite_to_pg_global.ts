/**
 * SQLite → PostgreSQL Migration for Global Database
 * 
 * Migrates: global_products, global_dci, global_actes, global_suppliers
 * 
 * Run from backend/: npx ts-node --transpile-only scripts/migrate_sqlite_to_pg_global.ts
 */

import { globalQuery, globalTransaction } from '../db/globalPg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const SQLITE_DB_PATH = path.join(__dirname, '../data/global/global.db');

// Helper to promisify sqlite3 all()
function allAsync(db: sqlite3.Database, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function run() {
    console.log('='.repeat(70));
    console.log('SQLite → PostgreSQL Global Database Migration');
    console.log('='.repeat(70));
    
    if (!fs.existsSync(SQLITE_DB_PATH)) {
        console.error(`❌ SQLite database not found: ${SQLITE_DB_PATH}`);
        process.exit(1);
    }
    
    const sqlite = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    console.log(`Source: ${SQLITE_DB_PATH}\n`);
    
    // =========================================================================
    // 1. MIGRATE global_suppliers
    // =========================================================================
    console.log('1) Migrating global_suppliers...');
    const suppliers = await allAsync(sqlite, 'SELECT * FROM global_suppliers');
    console.log(`   Found ${suppliers.length} rows in SQLite`);
    
    await globalTransaction(async (client) => {
        for (const s of suppliers) {
            await client.query(`
                INSERT INTO global_suppliers (id, name, contact_name, email, phone, address, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    contact_name = EXCLUDED.contact_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    is_active = EXCLUDED.is_active
            `, [
                s.id,
                s.name,
                s.contact_name || null,
                s.email || null,
                s.phone || null,
                s.address || null,
                s.is_active ?? true,
                s.created_at || new Date().toISOString()
            ]);
        }
    });
    console.log(`   ✅ Migrated ${suppliers.length} suppliers`);
    
    // =========================================================================
    // 2. MIGRATE global_dci
    // =========================================================================
    console.log('\n2) Migrating global_dci...');
    const dcis = await allAsync(sqlite, 'SELECT * FROM global_dci');
    console.log(`   Found ${dcis.length} rows in SQLite`);
    
    await globalTransaction(async (client) => {
        let count = 0;
        for (const d of dcis) {
            await client.query(`
                INSERT INTO global_dci (id, name, atc_code, therapeutic_class, synonyms)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    atc_code = EXCLUDED.atc_code,
                    therapeutic_class = EXCLUDED.therapeutic_class,
                    synonyms = EXCLUDED.synonyms
            `, [
                d.id,
                d.name,
                d.atc_code || null,
                d.therapeutic_class || null,
                d.synonyms || '[]'
            ]);
            count++;
            if (count % 1000 === 0) console.log(`   ... ${count} DCIs`);
        }
    });
    console.log(`   ✅ Migrated ${dcis.length} DCIs`);
    
    // =========================================================================
    // 3. MIGRATE global_actes
    // =========================================================================
    console.log('\n3) Migrating global_actes...');
    const actes = await allAsync(sqlite, 'SELECT * FROM global_actes');
    console.log(`   Found ${actes.length} rows in SQLite`);
    
    await globalTransaction(async (client) => {
        let count = 0;
        for (const a of actes) {
            await client.query(`
                INSERT INTO global_actes (id, code, name, specialty, base_price, category)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    specialty = EXCLUDED.specialty,
                    base_price = EXCLUDED.base_price,
                    category = EXCLUDED.category
            `, [
                a.id,
                a.code || null,
                a.name,
                a.specialty || null,
                a.base_price || 0,
                a.category || null
            ]);
            count++;
            if (count % 500 === 0) console.log(`   ... ${count} actes`);
        }
    });
    console.log(`   ✅ Migrated ${actes.length} actes`);
    
    // =========================================================================
    // 4. MIGRATE global_products
    // =========================================================================
    console.log('\n4) Migrating global_products...');
    const products = await allAsync(sqlite, 'SELECT * FROM global_products');
    console.log(`   Found ${products.length} rows in SQLite`);
    
    await globalTransaction(async (client) => {
        let count = 0;
        for (const p of products) {
            await client.query(`
                INSERT INTO global_products (
                    id, type, name, form, dci_composition, presentation, manufacturer, 
                    ppv, ph, pfht, class_therapeutique, atc_code, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    type = EXCLUDED.type,
                    name = EXCLUDED.name,
                    form = EXCLUDED.form,
                    dci_composition = EXCLUDED.dci_composition,
                    presentation = EXCLUDED.presentation,
                    manufacturer = EXCLUDED.manufacturer,
                    ppv = EXCLUDED.ppv,
                    ph = EXCLUDED.ph,
                    pfht = EXCLUDED.pfht,
                    class_therapeutique = EXCLUDED.class_therapeutique,
                    atc_code = EXCLUDED.atc_code,
                    is_active = EXCLUDED.is_active
            `, [
                p.id,
                p.type || 'MEDICAMENT',
                p.name,
                p.form || null,
                p.dci || p.dci_composition || '[]',  // dci column in SQLite stores JSON
                p.presentation || null,
                p.manufacturer || null,
                p.ppv || 0,
                p.ph || 0,
                p.pfht || null,
                p.class_therapeutique || null,
                p.atc_code || null,
                p.is_active ?? true
            ]);
            count++;
            if (count % 1000 === 0) console.log(`   ... ${count} products`);
        }
    });
    console.log(`   ✅ Migrated ${products.length} products`);
    
    // =========================================================================
    // VERIFICATION
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('VERIFICATION');
    console.log('─'.repeat(70));
    
    const pgSuppliers = await globalQuery('SELECT COUNT(*) as cnt FROM global_suppliers', []);
    const pgDCIs = await globalQuery('SELECT COUNT(*) as cnt FROM global_dci', []);
    const pgActes = await globalQuery('SELECT COUNT(*) as cnt FROM global_actes', []);
    const pgProducts = await globalQuery('SELECT COUNT(*) as cnt FROM global_products', []);
    
    console.log(`\nPostgreSQL row counts:`);
    console.log(`   global_suppliers: ${pgSuppliers[0].cnt}`);
    console.log(`   global_dci: ${pgDCIs[0].cnt}`);
    console.log(`   global_actes: ${pgActes[0].cnt}`);
    console.log(`   global_products: ${pgProducts[0].cnt}`);
    
    sqlite.close();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(70));
}

run().catch(e => {
    console.error('\n❌ MIGRATION FAILED:', e.message);
    process.exit(1);
});
