
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'backend', 'data', 'pharmacy_db.json');

// Interface to match the target structure
interface StockLocation {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    tenantId?: string;
    serviceId?: string;
    scope?: 'PHARMACY' | 'SERVICE'; // New Field
    type?: string; 
}

interface InventoryItem {
    id: string;
    location: string;
    serviceId?: string;
    tenantId?: string;
    // ... other fields
}

function runMigration() {
    console.log("Starting Stock Separation Migration...");

    if (!fs.existsSync(DB_PATH)) {
        console.error("Database file not found!");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const locations: StockLocation[] = data.locations || [];
    const inventory: InventoryItem[] = data.inventory || [];

    // 1. Identify and Fix Pharmacy Locations
    // Heuristic: If name is "Zone picking" or "Picking PSL", it is PHARMACY.
    // Also, if created before the recent mess (check IDs?), but name is safest.
    const pharmacyNames = ["Zone picking", "Picking PSL", "Réserve centrale", "Frigo Pharmacie"];
    
    let pharmacyCount = 0;
    locations.forEach(loc => {
        if (pharmacyNames.includes(loc.name) || !loc.serviceId) {
            console.log(`Restoring Pharmacy Location: ${loc.name}`);
            delete loc.serviceId; // Remove the serviceId that was incorrectly added
            loc.scope = 'PHARMACY';
            pharmacyCount++;
        }
    });

    // 2. Identify Missing Service Locations from Inventory
    const missingLocations = new Map<string, string>(); // ID -> inferred ServiceID

    inventory.forEach(item => {
        // Skip if location name matches a known pharmacy location name (legacy string usage)
        // But wait, inventory items for Service Stock use "LOC-EMR-..." as location usually.
        // Pharmacy inventory uses "Zone picking".
        
        // If the item has a serviceId, it's a Service Stock item (usually).
        // Let's check if the location ID exists in our locations array.
        
        const locExists = locations.find(l => l.id === item.location || l.name === item.location);
        
        if (!locExists && item.serviceId && item.serviceId !== 'SERVICE_DEFAULT') {
            // This is a missing service location!
            missingLocations.set(item.location, item.serviceId);
        }
    });

    console.log("Found missing service locations:", Array.from(missingLocations.keys()));

    // 3. Create Missing Service Locations
    let newServiceLocCount = 0;
    missingLocations.forEach((serviceId, locId) => {
        // Generate a friendly name
        let friendlyName = `Emplacement ${locId}`;
        if (locId.includes('EMR')) friendlyName = `Armoire Service (${locId.substr(-4)})`;
        if (locId.includes('FRIGO')) friendlyName = "Frigo Service";
        if (locId.includes('RESERVE')) friendlyName = "Réserve Service";
        
        const newLoc: StockLocation = {
            id: locId,
            name: friendlyName,
            description: "Restored from legacy inventory data",
            isActive: true,
            tenantId: "client_demo", // Assuming demo for recovery
            serviceId: serviceId,
            scope: 'SERVICE',
            type: 'SHELF'
        };
        
        locations.push(newLoc);
        newServiceLocCount++;
        console.log(`Created Service Location: ${friendlyName} (${locId}) for service ${serviceId}`);
    });

    // 4. Ensure all existing Service Locations have scope='SERVICE'
    locations.forEach(loc => {
        if (loc.serviceId && !loc.scope) {
            loc.scope = 'SERVICE';
        }
    });

    // 5. Cleanup Inventory Location References?
    // If inventory.location matches a Name, that's fine if unique. 
    // Ideally should be IDs. But we won't break that now, just ensure the Location record exists with that ID or Name.
    // Our check in step 2 handled "id === item.location || l.name === item.location".
    // So if item.location is "Zone picking", it found the pharmacy loc.
    // If item.location was "LOC-EMR...", it didn't find it, so we created it with id="LOC-EMR...". 
    // So item.location (id) now matches location.id. Good.

    // Write back
    data.locations = locations;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

    console.log("Migration Complete.");
    console.log(`- Restored ${pharmacyCount} Pharmacy Locations`);
    console.log(`- Created ${newServiceLocCount} Missing Service Locations`);
}

runMigration();
