import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, 'backend/data/pharmacy_db.json');

try {
    if (fs.existsSync(dbPath)) {
        const rawData = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(rawData);

        // Keys to CLEAR (Transactional)
        data.inventory = [];
        data.serializedPacks = [];
        data.dispensations = [];
        data.replenishmentRequests = [];
        data.deliveryNotes = [];
        data.stockOutHistory = [];
        data.pharmacyLedger = [];
        data.serviceLedgers = {};
        data.admissionLedgers = {};
        data.movementLogs = [];
        data.looseUnits = [];
        
        // Keys to KEEP (Master Data)
        // catalog, suppliers, locations, productVersions, partnerInstitutions
        
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log("Pharmacy Stock Data (Transactions) has been CLEARED.");
        console.log("Master Data (Catalog, Suppliers, Locations) preserved.");
    } else {
        console.log("DB File not found, nothing to clear.");
    }

} catch (error) {
    console.error("Error resetting DB:", error);
}
