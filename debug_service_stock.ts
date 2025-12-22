
// Standalone debug script
const API_BASE_URL = 'http://localhost:3001/api';

async function fetchJson(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }
    return response.json();
}

async function debug() {
    try {
        console.log("Fetching Inventory...");
        const inventory = await fetchJson('/pharmacy/inventory');

        console.log("Fetching Requests...");
        const requests = await fetchJson('/pharmacy/replenishment-requests');

        console.log("--- Service Inventory Items ---");
        // @ts-ignore
        const serviceItems = inventory.filter(i => !!i.serviceId);
        // @ts-ignore
        serviceItems.forEach(i => {
            console.log(`Item: ${i.name}, Service ID: ${i.serviceId}, Loc: ${i.location}, Qty: ${i.theoreticalQty}`);
        });

        console.log("\n--- Checking for Zyrtec ---");
        // @ts-ignore
        const zyrtec = inventory.filter(i => i.name.toLowerCase().includes('zyrtec'));
        if (zyrtec.length === 0) {
            console.log("No Zyrtec found in ANY inventory.");
        } else {
            // @ts-ignore
            zyrtec.forEach(i => {
                console.log(`Found Zyrtec: ServiceId=[${i.serviceId}], Loc=[${i.location}], Qty=[${i.theoreticalQty}]`);
            });
        }

        console.log("\n--- Checking Requests Status ---");
        // @ts-ignore
        const approvedReqs = requests.filter(r => r.status === 'Approuvée' || r.status === 'APPROVED');
        // @ts-ignore
        approvedReqs.forEach(r => {
            console.log(`Request ${r.id}: Status=${r.status}, Service=${r.serviceName}`);
            // @ts-ignore
            r.items.forEach(item => {
                if (item.productName.toLowerCase().includes('zyrtec')) {
                    console.log(`   -> Item: ${item.productName}, QtyApproved: ${item.quantityApproved}, DispensedBatches: ${item.dispensedBatches?.length}`);
                }
            });
        });

    } catch (e) {
        console.error("Error", e);
    }
}

debug();
