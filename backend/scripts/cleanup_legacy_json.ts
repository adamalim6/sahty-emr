
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'legacy_json_backup_' + Date.now());

function moveFile(filePath: string) {
    if (fs.existsSync(filePath)) {
        const relPath = path.relative(DATA_DIR, filePath);
        const destPath = path.join(BACKUP_DIR, relPath);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.renameSync(filePath, destPath);
        console.log(`Moved: ${relPath}`);
    }
}

function cleanupTenant(tenantId: string) {
    const tenantDir = path.join(DATA_DIR, 'tenants', tenantId);
    if (!fs.existsSync(tenantDir)) return;

    // Settings
    moveFile(path.join(tenantDir, 'settings/users.json'));
    moveFile(path.join(tenantDir, 'settings/roles.json'));
    moveFile(path.join(tenantDir, 'settings/services.json'));
    moveFile(path.join(tenantDir, 'settings/rooms.json'));
    
    // EMR
    moveFile(path.join(tenantDir, 'emr/emr_admissions.json'));
    moveFile(path.join(tenantDir, 'emr/emr_appointments.json'));
    
    // Catalog
    moveFile(path.join(tenantDir, 'pharmacy_catalog.json'));
    
    // Suppliers (if present)
    moveFile(path.join(tenantDir, 'suppliers.json'));
}

async function runCallback() {
    console.log(`Creating backup at: ${BACKUP_DIR}`);
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Global Files
    moveFile(path.join(DATA_DIR, 'clients.json'));
    moveFile(path.join(DATA_DIR, 'organismes.json'));
    moveFile(path.join(DATA_DIR, 'global/admins.json'));
    moveFile(path.join(DATA_DIR, 'global/patients.json'));
    moveFile(path.join(DATA_DIR, 'global/dci.json'));
    moveFile(path.join(DATA_DIR, 'global/products.json'));
    
    // Extensions
    moveFile(path.join(DATA_DIR, 'global/actes.json'));
    moveFile(path.join(DATA_DIR, 'global/atc_tree.json'));
    moveFile(path.join(DATA_DIR, 'global/emdn_tree.json'));
    moveFile(path.join(DATA_DIR, 'global/roles.json'));
    moveFile(path.join(DATA_DIR, 'global/suppliers.json'));
    moveFile(path.join(DATA_DIR, 'global/atc_codes.rdf'));
    
    // Root Data
    moveFile(path.join(DATA_DIR, 'users.json'));
    
    // Tenants
    const tenantsDir = path.join(DATA_DIR, 'tenants');
    if (fs.existsSync(tenantsDir)) {
        const tenants = fs.readdirSync(tenantsDir).filter(name => fs.statSync(path.join(tenantsDir, name)).isDirectory());
        for (const t of tenants) {
            cleanupTenant(t);
        }
    }
    
    console.log("Cleanup Complete.");
}

runCallback();
