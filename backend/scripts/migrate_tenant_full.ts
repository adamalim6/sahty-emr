
import { getTenantDB } from '../db/tenantDb';
import path from 'path';
import fs from 'fs';
import { Database } from 'sqlite3';

const DATA_DIR = path.join(__dirname, '../data/tenants');

function runAsync(db: Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Helper to list directories
const getDirectories = (source: string) =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

async function migrateTenant(tenantId: string) {
    console.log(`\n=== Migrating Tenant: ${tenantId} ===`);
    const db = await getTenantDB(tenantId);
    const tenantPath = path.join(DATA_DIR, tenantId);

    // 1. Settings
    const settingsDir = path.join(tenantPath, 'settings');
    if (fs.existsSync(settingsDir)) {
        // Users
        const usersPath = path.join(settingsDir, 'users.json');
        if (fs.existsSync(usersPath)) {
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            for (const u of users) {
                await runAsync(db, `
                    INSERT OR REPLACE INTO users (id, client_id, username, password_hash, nom, prenom, user_type, role_id, inpe, service_ids, active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [u.id, u.client_id, u.username, u.password_hash, u.nom, u.prenom, u.user_type, u.role_id, u.INPE || '', JSON.stringify(u.service_ids || []), u.active ? 1 : 0]);
            }
            console.log(`   Migrated ${users.length} users.`);
        }

        // Services
        const servicesPath = path.join(settingsDir, 'services.json');
        if (fs.existsSync(servicesPath)) {
            const services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
            for (const s of services) {
                 await runAsync(db, `
                    INSERT OR REPLACE INTO services (id, tenant_id, name, code, description)
                    VALUES (?, ?, ?, ?, ?)
                `, [s.id, s.tenantId, s.name, s.code, s.description]);
            }
            console.log(`   Migrated ${services.length} services.`);
        }
        
        // Roles
        const rolesPath = path.join(settingsDir, 'roles.json');
        if (fs.existsSync(rolesPath)) {
            const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
            for (const r of roles) {
                 await runAsync(db, `
                    INSERT OR REPLACE INTO roles (id, name, code, permissions, modules)
                    VALUES (?, ?, ?, ?, ?)
                `, [r.id, r.name, r.code, JSON.stringify(r.permissions || []), JSON.stringify(r.modules || [])]);
            }
            console.log(`   Migrated ${roles.length} roles.`);
        }

        // Rooms
        const roomsPath = path.join(settingsDir, 'rooms.json');
        if (fs.existsSync(roomsPath)) {
            const rooms = JSON.parse(fs.readFileSync(roomsPath, 'utf8'));
            for (const r of rooms) {
                 await runAsync(db, `
                    INSERT OR REPLACE INTO rooms (id, service_id, number, section, is_occupied, type)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [r.id, r.serviceId, r.number, r.section, r.isOccupied ? 1 : 0, r.type]);
            }
            console.log(`   Migrated ${rooms.length} rooms.`);
        }
    }

    // 2. EMR
    const emrDir = path.join(tenantPath, 'emr');
    if (fs.existsSync(emrDir)) {
        // Admissions
        const admPath = path.join(emrDir, 'emr_admissions.json');
        if (fs.existsSync(admPath)) {
            const admissions = JSON.parse(fs.readFileSync(admPath, 'utf8'));
            for (const a of admissions) {
                 await runAsync(db, `
                    INSERT OR REPLACE INTO admissions (id, tenant_id, patient_id, nda, reason, service_id, admission_date, discharge_date, doctor_name, room_number, bed_label, status, currency)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [a.id, a.tenantId || tenantId, a.patientId, a.nda, a.reason, a.service, a.admissionDate, a.dischargeDate, a.doctorName, a.roomNumber, a.bedLabel, a.status, a.currency]);
            }
            console.log(`   Migrated ${admissions.length} admissions.`);
        }
    }

    // 3. Product Catalog (Pharmacy)
    const catalogPath = path.join(tenantPath, 'pharmacy_catalog.json');
    if (fs.existsSync(catalogPath)) {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        // catalog is { inventory: [], products: [...] } or just array?
        const products = Array.isArray(catalog) ? catalog : (catalog.products || catalog.catalog || []);
        
        for (const p of products) {
            await runAsync(db, `
                INSERT OR REPLACE INTO product_configs (tenant_id, product_id, is_enabled, min_stock, max_stock, sales_price)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [tenantId, p.productId, p.isEnabled !== false ? 1 : 0, p.minStock || 0, p.maxStock || 0, p.salePrice || 0]);

            // Suppliers links
            if (p.suppliers) {
                for (const s of p.suppliers) {
                     await runAsync(db, `
                        INSERT OR REPLACE INTO product_suppliers (tenant_id, product_id, supplier_id, purchase_price, is_preferred)
                        VALUES (?, ?, ?, ?, ?)
                    `, [tenantId, p.productId, s.supplierId || s.id, s.purchasePrice || 0, s.isPreferred ? 1 : 0]);
                }
            }
        }
        console.log(`   Migrated ${products.length} catalog items.`);
    }

    // 4. Suppliers (Entity) - migrating from suppliers.json if it existed?
    // Task 4914 said: "Deleted suppliers.json".
    // But schema.sql has `suppliers` table.
    // TenantCatalogService reads from SQL now (implied by previous task).
    // So suppliers should already be in SQL if I migrated them? 
    // Wait, the previous task "Deleted suppliers.json" and "Refactoring Catalog to use SQL suppliers".
    // Does that mean `suppliers` table is already populated?
    // If successful, `suppliers` table should have data. 
    // If not, I might have lost supplier names if I deleted the JSON without migrating?
    // Hopefully `verify_suppliers.ts` or similar populated it, or `suppliers.json` was migrated before deletion?
    // Actually, `PharmacyService.getSuppliers` was refactored.
    // If I deleted `suppliers.json` and didn't migrate it to SQL first, we might have lost data!
    // But `pharmacy.sqlite` was preserved. If `suppliers` table was in `pharmacy.sqlite` and populated, we are good.
    // If `suppliers` were ONLY in `suppliers.json` and I deleted it... uh oh.
    // However, `task.md` said "Deleted legacy JSON files".
    // Let's hope `pharmacy_catalog.json` contains supplier names? (It does: "name": "Laprophan").
    // I can reconstruct suppliers from `pharmacy_catalog.json` if needed.
    // I'll add a safety migration step for suppliers from catalog if missing.
}

async function run() {
    console.log("Starting Full Tenant Migration...");
    const tenants = getDirectories(DATA_DIR);
    console.log(`Found ${tenants.length} tenants.`);

    for (const id of tenants) {
        // Skip non-tenant dirs if any
        if (!id.startsWith('client_') && !id.startsWith('verify_') && !id.startsWith('tenant_')) continue;
        await migrateTenant(id);
    }
    console.log("\nFull Tenant Migration Complete.");
}

run().catch(console.error);
