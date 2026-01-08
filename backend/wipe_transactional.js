
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data/pharmacy_db.json');

if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);

    // Keys to PRESERVE (Configuration / Static Data)
    const preserved = {
        catalog: data.catalog || [],
        suppliers: data.suppliers || [],
        partners: data.partners || [],
        locations: data.locations || [],
        productVersions: data.productVersions || [],
        globalSuppliers: data.globalSuppliers || [] // If keys exist
    };

    // New Data Structure
    const newData = {
        ...preserved,
        inventory: [],
        serializedPacks: [],
        looseUnits: [],
        replenishmentRequests: [],
        dispensations: [],
        stockOutHistory: [],
        purchaseOrders: [],
        deliveryNotes: [],
        returns: [] // Ensure returns are cleared too
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
    console.log("✅ Pharmacy Transactional Data Wiped (Catalog & Locations Preserved).");
} else {
    console.log("⚠️ No DB file found.");
}
