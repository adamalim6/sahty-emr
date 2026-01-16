import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, 'data');
const PHARMACY_DB = path.join(DATA_DIR, 'pharmacy_db.json');
const PRESCRIPTIONS_DB = path.join(DATA_DIR, 'prescriptions_db.json');
const EXECUTIONS_DB = path.join(DATA_DIR, 'executions_db.json');
const RETURNS_DB = path.join(DATA_DIR, 'returns_db.json');

const wipePharmacyDB = () => {
    if (fs.existsSync(PHARMACY_DB)) {
        const raw = fs.readFileSync(PHARMACY_DB, 'utf-8');
        const data = JSON.parse(raw);

        // Keep Configuration
        // catalog, locations, partners, suppliers, productVersions (maybe?)

        // Wipe Transactional/Stock Data
        data.inventory = [];
        data.stockOutHistory = [];
        data.purchaseOrders = [];
        data.deliveryNotes = [];
        data.serializedPacks = [];
        data.dispensations = [];
        data.replenishmentRequests = [];
        data.looseUnits = [];
        
        // Optional: Reset stats in catalog?
        if (data.catalog) {
            data.catalog = data.catalog.map((p: any) => ({
                ...p,
                currentStock: 0
            }));
        }

        fs.writeFileSync(PHARMACY_DB, JSON.stringify(data, null, 2));
        console.log('Scaled down pharmacy_db.json (Kept catalog/locations/partners/suppliers)');
    } else {
        console.log('pharmacy_db.json not found');
    }
};

const wipeFile = (filePath: string, defaultContent: any = []) => {
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
        console.log(`Wiped ${path.basename(filePath)}`);
    }
};

try {
    console.log('Starting data wipe...');
    wipePharmacyDB();
    wipeFile(PRESCRIPTIONS_DB, []);
    wipeFile(EXECUTIONS_DB, []);
    wipeFile(RETURNS_DB, []);
    console.log('Data wipe complete.');
} catch (error) {
    console.error('Error wiping data:', error);
}
