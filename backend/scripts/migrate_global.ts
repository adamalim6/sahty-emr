
import { getGlobalDB } from '../db/globalDb';
import path from 'path';
import fs from 'fs';
import { Database } from 'sqlite3';

const DATA_DIR = path.join(__dirname, '../data');

// Helper to promisify run
function runAsync(db: Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function migrateGlobal() {
    console.log('=== STARTING GLOBAL MIGRATION ===');
    const db = await getGlobalDB();

    // 1. Clients
    console.log('Migrating Clients...');
    const clientsPath = path.join(DATA_DIR, 'clients.json');
    if (fs.existsSync(clientsPath)) {
        const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
        for (const c of clients) {
            await runAsync(db, `
                INSERT OR REPLACE INTO clients (id, type, designation, siege_social, representant_legal, country)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [c.id, c.type, c.designation, c.siege_social, c.representant_legal, c.country]);
        }
        console.log(`Migrated ${clients.length} clients.`);
    }

    // 2. Organismes
    console.log('Migrating Organismes...');
    const orgPath = path.join(DATA_DIR, 'organismes.json');
    if (fs.existsSync(orgPath)) {
        const orgs = JSON.parse(fs.readFileSync(orgPath, 'utf8'));
        for (const o of orgs) {
            await runAsync(db, `
                INSERT OR REPLACE INTO organismes (id, designation, category, sub_type, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [o.id, o.designation, o.category, o.sub_type, o.active ? 1 : 0, o.created_at || new Date().toISOString(), o.updated_at || new Date().toISOString()]);
        }
        console.log(`Migrated ${orgs.length} organismes.`);
    }

    // 3. Global Users (Super Admins)
    console.log('Migrating Global Admins...');
    const adminsPath = path.join(DATA_DIR, 'global/admins.json');
    if (fs.existsSync(adminsPath)) {
        const admins = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
        for (const u of admins) {
            await runAsync(db, `
                INSERT OR REPLACE INTO users (id, username, password_hash, nom, prenom, user_type, role_code, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [u.id, u.username, u.password_hash, u.nom, u.prenom, u.user_type, u.role_code || 'SUPER_ADMIN', u.active ? 1 : 0]);
        }
        console.log(`Migrated ${admins.length} global admins.`);
    }

    // 4. Patients (Global Index)
    console.log('Migrating Global Patients...');
    const patientsPath = path.join(DATA_DIR, 'global/patients.json');
    if (fs.existsSync(patientsPath)) {
        const patients = JSON.parse(fs.readFileSync(patientsPath, 'utf8'));
        for (const p of patients) {
            await runAsync(db, `
                INSERT OR REPLACE INTO patients (
                    id, ipp, firstName, lastName, dateOfBirth, gender, cin, phone, email, 
                    address, city, country, nationality, maritalStatus, profession, bloodGroup, isPayant,
                    insurance_data, emergency_contacts, guardian_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                p.id, p.ipp, p.firstName, p.lastName, p.dateOfBirth, p.gender, p.cin, p.phone, p.email,
                p.address, p.city, p.country, p.nationality, p.maritalStatus, p.profession, p.bloodGroup, p.isPayant ? 1 : 0,
                JSON.stringify(p.insurance || {}),
                JSON.stringify(p.emergencyContacts || []),
                JSON.stringify(p.guardian || {})
            ]);
        }
        console.log(`Migrated ${patients.length} patients.`);
    }
    
    // 5. Global DCI
    console.log('Migrating Global DCI...');
    const dciPath = path.join(DATA_DIR, 'global/dci.json');
    if (fs.existsSync(dciPath)) {
         const dcis = JSON.parse(fs.readFileSync(dciPath, 'utf8'));
         let count = 0;
         await runAsync(db, 'BEGIN TRANSACTION');
         for (const d of dcis) {
             await runAsync(db, `
                 INSERT OR REPLACE INTO global_dci (id, name, atc_code, therapeutic_class, synonyms)
                 VALUES (?, ?, ?, ?, ?)
             `, [d.id, d.name, d.atc_code, d.therapeutic_class, JSON.stringify(d.synonyms || [])]);
             count++;
         }
         await runAsync(db, 'COMMIT');
         console.log(`Migrated ${count} DCIs.`);
    }

    // 6. Global Products
    console.log('Migrating Global Products...');
    const productsPath = path.join(DATA_DIR, 'global/products.json');
    if (fs.existsSync(productsPath)) {
         const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
         let count = 0;
         await runAsync(db, 'BEGIN TRANSACTION');
         for (const p of products) {
             // Extract DCI name if simple composition, or just store composition in 'dci' column as JSON?
             // Schema has dci TEXT. Let's store JSON of dciComposition for flexibility.
             const dciValue = JSON.stringify(p.dciComposition || []);
             const atc = p.dciComposition?.[0]?.atcCode || null;

             await runAsync(db, `
                 INSERT OR REPLACE INTO global_products (
                     id, type, name, dci, form, dosage, presentation, manufacturer, ppv, ph, class_therapeutique, atc_code, is_active
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             `, [
                 p.id, 
                 p.type || 'MEDICAMENT', 
                 p.name, 
                 dciValue, 
                 p.form, 
                 JSON.stringify(p.dciComposition?.[0]?.dosage) || null, // simplifying dosage
                 p.presentation, 
                 p.manufacturer, 
                 p.marketInfo?.ppv || 0, 
                 p.marketInfo?.ph || 0, 
                 null, // therapeutic class usually derived from DCI/ATC
                 atc, 
                 p.isEnabled ? 1 : 0
             ]);
             count++;
         }
         await runAsync(db, 'COMMIT');
         console.log(`Migrated ${count} products.`);
    }

    console.log('=== GLOBAL MIGRATION COMPLETE ===');
}

migrateGlobal().catch(console.error);
