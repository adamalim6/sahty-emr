
import * as fs from 'fs';
import * as path from 'path';

// Define paths
const DATA_ROOT = path.resolve(__dirname, '../data/tenants');

const KEYS_TO_MIGRATE = [
    'inventory',
    'locations',
    'partners',
    'stockOutHistory',
    'purchaseOrders',
    'serializedPacks',
    'looseUnits',
    'dispensations',
    'replenishmentRequests',
    'pharmacyLedger',
    'serviceLedgers',
    'movementLogs',
    'returnRequests',
    'containers',
    'deliveryNotes'
];

async function migrateTenant(tenantId: string) {
    const tenantDir = path.join(DATA_ROOT, tenantId);
    const pharmacyFile = path.join(tenantDir, 'pharmacy.json');
    const pharmacyDir = path.join(tenantDir, 'pharmacy');

    if (!fs.existsSync(pharmacyFile)) {
        console.log(`[SKIP] No pharmacy.json for tenant ${tenantId}`);
        return;
    }

    console.log(`[MIGRATE] Migrating tenant ${tenantId}...`);

    // Read monolithic file
    const rawData = fs.readFileSync(pharmacyFile, 'utf-8');
    let data;
    try {
        data = JSON.parse(rawData);
    } catch (e) {
        console.error(`[ERROR] Failed to parse pharmacy.json for ${tenantId}`, e);
        return;
    }

    // Create pharmacy/ directory
    if (!fs.existsSync(pharmacyDir)) {
        fs.mkdirSync(pharmacyDir, { recursive: true });
    }

    // Iterate and write granular files
    for (const key of KEYS_TO_MIGRATE) {
        const content = data[key] || (key === 'serviceLedgers' ? {} : []);
        const targetFile = path.join(pharmacyDir, `${key}.json`);
        
        fs.writeFileSync(targetFile, JSON.stringify(content, null, 2), 'utf-8');
        console.log(`   -> Wrote ${key}.json`);
    }

    // Archive original file
    const archivePath = path.join(tenantDir, 'pharmacy_monolithic_backup.json');
    fs.renameSync(pharmacyFile, archivePath);
    console.log(`   -> Archived pharmacy.json to pharmacy_monolithic_backup.json`);
}

async function main() {
    if (!fs.existsSync(DATA_ROOT)) {
        console.error("Tenants directory not found!");
        process.exit(1);
    }

    const tenants = fs.readdirSync(DATA_ROOT).filter(f => fs.statSync(path.join(DATA_ROOT, f)).isDirectory());

    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
        await migrateTenant(tenant);
    }

    console.log("Migration complete.");
}

main().catch(console.error);
