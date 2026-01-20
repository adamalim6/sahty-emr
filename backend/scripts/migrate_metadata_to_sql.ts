

import { getTenantDB } from '../db/tenantDb';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read JSON
const readJson = (filePath: string) => {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
};

const runQuery = async (tenantId: string, sql: string, params: any[]) => {
    const db = await getTenantDB(tenantId);
    return new Promise<void>((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const migrate = async () => {
    console.log("Starting Migration...");

    const tenantsDir = path.join(__dirname, '../data/tenants');
    
    if (!fs.existsSync(tenantsDir)) {
        console.log("No tenants directory found.");
        return;
    }

    const tenants = fs.readdirSync(tenantsDir).filter(f => fs.statSync(path.join(tenantsDir, f)).isDirectory());

    for (const tenantId of tenants) {
        console.log(`Migrating Tenant: ${tenantId}`);
        const pharmacyLocPath = path.join(tenantsDir, tenantId, 'pharmacy/pharmacy_locations.json');
        const deptLocPath = path.join(tenantsDir, tenantId, 'pharmacy/department_locations.json');
        const partnersPath = path.join(tenantsDir, tenantId, 'pharmacy/partners.json'); 

        // 1. Locations
        const pLocs = readJson(pharmacyLocPath);
        const dLocs = readJson(deptLocPath);
        const allLocs = [...pLocs, ...dLocs];

        for (const loc of allLocs) {
            await runQuery(tenantId, `
                INSERT OR IGNORE INTO locations (tenant_id, location_id, name, type, scope, service_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [tenantId, loc.id, loc.name, loc.type || 'UNKNOWN', loc.scope || 'PHARMACY', loc.serviceId || null]);
            // console.log(`  Inserted Location: ${loc.id}`);
        }
        console.log(`  Processed ${allLocs.length} locations.`);

        // 2. Suppliers
        const partners = readJson(partnersPath);
        for (const p of partners) {
            await runQuery(tenantId, `
                INSERT OR IGNORE INTO suppliers (tenant_id, supplier_id, name, email, phone, address)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [tenantId, p.id, p.name, p.email, p.phone, p.address]);
            // console.log(`  Inserted Supplier: ${p.id}`);
        }
        console.log(`  Processed ${partners.length} suppliers.`);
    }

    console.log("Migration Complete.");
};

migrate().catch(console.error);
