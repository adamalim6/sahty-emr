
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'backend', 'data', 'pharmacy_db.json');

interface StockLocation {
    id: string;
    name: string;
    scope?: 'PHARMACY' | 'SERVICE';
    serviceId?: string;
}

interface InventoryItem {
    id: string;
    location: string;
    serviceId?: string;
    [key: string]: any;
}

function cleanupInventory() {
    console.log("Starting inventory cleanup...");

    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const db = JSON.parse(raw);
        
        const locations: StockLocation[] = db.locations || [];
        const inventory: InventoryItem[] = db.inventory || [];

        // 1. Identify Pharmacy Locations
        const pharmacyLocationIds = new Set(
            locations
                .filter(l => l.scope === 'PHARMACY' || (!l.scope && !l.serviceId))
                .map(l => l.id)
        );
        
        // Also add names as IDs because 'location' field often holds the name for legacy locations
        locations
            .filter(l => l.scope === 'PHARMACY' || (!l.scope && !l.serviceId))
            .forEach(l => pharmacyLocationIds.add(l.name));

        console.log("Pharmacy Locations identified:", Array.from(pharmacyLocationIds));

        // 2. Clean Inventory Items
        let cleanedCount = 0;
        const cleanedInventory = inventory.map(item => {
            // Check if item is in a pharmacy location but has a serviceId
            if (pharmacyLocationIds.has(item.location) && item.serviceId) {
                console.log(`Removing serviceId '${item.serviceId}' from item '${item.name}' (ID: ${item.id}) at location '${item.location}'`);
                const { serviceId, ...rest } = item;
                cleanedCount++;
                return rest;
            }
            return item;
        });

        if (cleanedCount > 0) {
            db.inventory = cleanedInventory;
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            console.log(`Successfully removed serviceId from ${cleanedCount} inventory items.`);
        } else {
            console.log("No inventory items required cleanup.");
        }

    } catch (error) {
        console.error("Error during cleanup:", error);
    }
}

cleanupInventory();
