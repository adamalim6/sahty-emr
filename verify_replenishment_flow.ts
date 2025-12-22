// verify_replenishment_flow.ts
// Removed imports to avoid resolution issues in standalone script

// If PharmacyService is designed for Frontend, it might fail in Node.
// Let's check PharmacyService.ts imports. 
// If it uses React hooks or Browser APIs, this script will fail.
// PharmacyService seems to be a class.
// Let's assume it works or we need to mock.
// Actually, in the previous session I ran this script and it worked??
// Ah, the previous script used `fetch` to localhost:3001.
// My NEW script imports `PharmacyService` directly.
// If the backend is running, I should use `fetch`.
// If I import Service, I am testing the Service Unit logic directly (if it doesn't depend on DB or Browser).
// Given the previous script used `fetch`, I should probably stick to `fetch` to test the Integration.
// BUT `updateReplenishmentRequestStatus` with DELTA payload is what I want to test.
// So I will revert to using `fetch` against the running server.

const BASE_URL = 'http://localhost:3001/api';

async function runVerification() {
    console.log("=== STARTING INCREMENTAL REPLENISHMENT VERIFICATION (INTEGRATION) ===");

    try {
        // 1. Get Inventory to find a product
        const invRes = await fetch(`${BASE_URL}/pharmacy/inventory`);
        const inventory = await invRes.json();
        const product = inventory.find((p: any) => !p.serviceId && p.theoreticalQty > 10);

        if (!product) {
            console.error("No suitable product found in pharmacy stock.");
            return;
        }

        const productId = product.productId;
        const productName = product.name;

        // Initial Stocks
        const initialPharmaStock = inventory
            .filter((i: any) => i.productId === productId && !i.serviceId)
            .reduce((sum: number, i: any) => sum + i.theoreticalQty, 0);

        const initialServiceStock = inventory
            .filter((i: any) => i.productId === productId && !!i.serviceId) // Any service
            .reduce((sum: number, i: any) => sum + i.theoreticalQty, 0);

        console.log(`Target: ${productName} (Initial Pharma: ${initialPharmaStock}, Service: ${initialServiceStock})`);

        // 2. Create Request
        console.log("Creating Request...");
        const createRes = await fetch(`${BASE_URL}/pharmacy/replenishments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requesterId: 'script-tester',
                requesterName: 'Auto Script',
                serviceName: 'SERVICE_TEST',
                items: [{
                    productId,
                    productName,
                    quantityRequested: 10,
                    targetLocationId: 'LOC-TEST'
                }]
            })
        });
        const req = await createRes.json();
        console.log(`Request Created: ${req.id}`);

        // 3. First Dispensation (Partial 4)
        console.log("--- Dispensing 4 Items ---");
        const delta1 = {
            items: [{
                productId,
                productName,
                quantityRequested: 10,
                quantityApproved: 4,
                dispensedBatches: [] // FEFO
            }]
        };

        const update1 = await fetch(`${BASE_URL}/pharmacy/replenishments/${req.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Approuvé', // ReplenishmentStatus.APPROVED
                processedRequest: delta1 // The controller expects 'processedRequest' key
            })
        });

        if (!update1.ok) throw new Error(`Update 1 Failed: ${await update1.text()}`);
        console.log("Update 1 OK");

        // Verify Stock 1
        await new Promise(r => setTimeout(r, 500));
        const inv1 = await (await fetch(`${BASE_URL}/pharmacy/inventory`)).json();
        const pharmaStock1 = inv1.filter((i: any) => i.productId === productId && !i.serviceId).reduce((s: number, i: any) => s + i.theoreticalQty, 0);

        console.log(`Stock After First (Expected ${initialPharmaStock - 4}): ${pharmaStock1}`);
        if (pharmaStock1 !== initialPharmaStock - 4) console.warn("WARNING: Stock 1 mismatch");

        // 4. Second Dispensation (Incremental 3)
        console.log("--- Dispensing 3 More Items ---");
        const delta2 = {
            items: [{
                productId,
                productName,
                quantityRequested: 10,
                quantityApproved: 3,
                dispensedBatches: [] // FEFO
            }]
        };

        const update2 = await fetch(`${BASE_URL}/pharmacy/replenishments/${req.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Approuvé',
                processedRequest: delta2
            })
        });

        if (!update2.ok) throw new Error(`Update 2 Failed: ${await update2.text()}`);
        const finalReq = await update2.json();

        // Verify Stock 2
        await new Promise(r => setTimeout(r, 500));
        const inv2 = await (await fetch(`${BASE_URL}/pharmacy/inventory`)).json();
        const pharmaStock2 = inv2.filter((i: any) => i.productId === productId && !i.serviceId).reduce((s: number, i: any) => s + i.theoreticalQty, 0);

        console.log(`Stock After Second (Expected ${initialPharmaStock - 7}): ${pharmaStock2}`);
        if (pharmaStock2 !== initialPharmaStock - 7) console.error("FAILED: Stock 2 mismatch");
        else console.log("PASSED: Stock deductions correct.");

        // Verify History Merging
        const finalItem = finalReq.items.find((i: any) => i.productId === productId);
        console.log(`Final Item Approved Qty (Expected 7): ${finalItem.quantityApproved}`);
        const batchCount = finalItem.dispensedBatches ? finalItem.dispensedBatches.length : 0;
        console.log(`Batches in history: ${batchCount}`);

        if (finalItem.quantityApproved === 7) console.log("PASSED: History Merged Correctly.");
        else console.error("FAILED: History merging.");

    } catch (e) {
        console.error("Verification Error:", e);
    }
}

runVerification();
