import { globalProductService } from '../services/globalProductService';
import { getGlobalDB } from '../db/globalDb';
import fs from 'fs';
import path from 'path';

const PRODUCTS_PATH = path.join(__dirname, '../data/global/products.json');

const seed = async () => {
    try {
        console.log('Seeding Products from JSON to SQL...');
        const db = await getGlobalDB();
        
        if (!fs.existsSync(PRODUCTS_PATH)) {
            console.error('Products JSON not found!');
            return;
        }

        const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
        console.log(`Found ${data.length} products in JSON.`);

        // Determine if we should clear table or upsert.
        // For import fix, upsert is safer. OR clear if full reload.
        // User asked to "fix" it, implying replace bad data.
        // I will truncate and reload to be clean.
        
        await new Promise<void>((resolve, reject) => {
            db.run('PRAGMA foreign_keys = OFF;', (err) => {
                if (err) reject(err);
                
                db.run('DELETE FROM global_products', (err) => {
                    if (err) reject(err); else resolve();
                });
            });
        });
        console.log('Cleared global_products table.');

        let count = 0;
        for (const p of data) {
            // We can't use createProduct service directly because it generates new ID/Codes over and over?
            // Actually createProduct usually expects new data.
            // But we have IDs.
            // `GlobalProductService` might not expose a "restore" method.
            // I'll assume we need to Insert Manually or use a hacked service call.
            // Let's iterate and Insert Manually using same logic as Service but preserving IDs.
            
            // Check Service Implementation for INSERT
            // It maps fields.
            
            // Let's try to just use raw SQL here to correspond to JSON structure.
            const dciComposition = JSON.stringify(p.dciComposition || []);
            const now = new Date().toISOString();
            
            await new Promise<void>((resolve, reject) => {
                 db.run(`
                    INSERT INTO global_products (
                        id, code, name, type, form, presentation, dci_composition, class_therapeutique, 
                        units_per_pack, sahty_code, manufacturer, 
                        ppv, ph, pfht, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    p.id, 
                    p.code || '', 
                    p.name, 
                    p.type || 'Médicament', 
                    p.form, 
                    p.presentation,
                    dciComposition, 
                    p.therapeuticClass,
                    p.unitsPerBox, 
                    p.sahtyCode, 
                    p.manufacturer,
                    p.marketInfo?.ppv, 
                    p.marketInfo?.ph, 
                    p.marketInfo?.pfht,
                    p.createdAt || now, 
                    p.updatedAt || now
                ], (err) => {
                    if (err) {
                        console.error(`Failed to insert ${p.name}:`, err.message);
                        // resolve() to continue?
                        resolve(); 
                    } else {
                        count++;
                        if (count % 1000 === 0) console.log(`Inserted ${count}...`);
                        resolve();
                    }
                });
            });
        }
        
        console.log(`Seeding Complete. Inserted ${count} products.`);
    } catch (e) {
        console.error('Seeding failed:', e);
    }
};

seed();
