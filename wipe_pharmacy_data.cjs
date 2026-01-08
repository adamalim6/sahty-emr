const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend/data/pharmacy_db.json');

try {
    if (!fs.existsSync(dbPath)) {
        console.log("No DB file found at " + dbPath);
        process.exit(0);
    }
    const rawData = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(rawData);

    console.log("Wiping transactional data...");

    // Wipe Transactional Data
    data.inventory = [];
    data.replenishmentRequests = [];
    data.dispensations = [];
    data.serializedPacks = [];
    data.stockOutHistory = [];
    data.purchaseOrders = [];
    data.deliveryNotes = [];
    
    // Reset Catalog Stock Counters
    if (data.catalog) {
        data.catalog = data.catalog.map(p => ({
            ...p,
            currentStock: 0
        }));
    }

    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    console.log("Pharmacy Data Wiped Successfully.");
    console.log("Cleared: Inventory, Requests, Dispensations, Packs, StockHistory, Orders, Deliveries.");

} catch (error) {
    console.error("Error wiping DB:", error);
}
