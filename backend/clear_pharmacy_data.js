
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data/pharmacy_db.json');

// Initialize with completely empty structure
const emptyData = {
    inventory: [],
    catalog: [],
    locations: [],
    partners: [],
    stockOutHistory: [],
    purchaseOrders: [],
    deliveryNotes: [],
    serializedPacks: [],
    dispensations: [],
    suppliers: [],
    replenishmentRequests: [],
    productVersions: []
};

// Write empty data
fs.writeFileSync(DB_FILE, JSON.stringify(emptyData, null, 2));

console.log("✅ Pharmacy DB completely wiped (including locations/partners).");
