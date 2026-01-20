
import { pharmacyService } from '../services/pharmacyService';
import { getTenantDB } from '../db/tenantDb';

const TENANT_ID = 'verify_write_tenant_' + Date.now();
const USER_ID = 'verify_user';

async function runVerification() {
    console.log(`\n=== 0. SETUP: Tenant ${TENANT_ID} ===`);
    const db = await getTenantDB(TENANT_ID);
    await pharmacyService.initServiceLedger(TENANT_ID, 'SERVICE_A'); // Does nothing but good to call

    // Clean start
    await pharmacyService.resetDB(TENANT_ID); 
    console.log("DB Reset.");

    // --- 1. PURCHASE ORDER ---
    console.log(`\n=== 1. CREATE PURCHASE ORDER ===`);
    const poItems = [
        { productId: 'PROD_001', orderedQty: 100, unitPrice: 10.5 },
        { productId: 'PROD_002', orderedQty: 50, unitPrice: 25.0 }
    ];
    const po = await pharmacyService.createPurchaseOrder({
        tenantId: TENANT_ID,
        supplierId: 'SUPPLIER_XYZ',
        items: poItems,
        userId: USER_ID
    });
    console.log("PO Created:", po.id, po.status);
    
    // Verify Read
    const pos = await pharmacyService.getPurchaseOrders(TENANT_ID);
    console.log("POs Found:", pos.length);
    if (pos.length !== 1 || pos[0].status !== 'ORDERED') throw new Error("PO Verification Failed");

    // --- 2. RECEIVE DELIVERY (PARTIAL) ---
    console.log(`\n=== 2. RECEIVE DELIVERY (PARTIAL) ===`);
    // Receive 50 of PROD_001 and 50 of PROD_002
    const deliveryItems = [
        { productId: 'PROD_001', deliveredQty: 50, batchNumber: 'BATCH_A1', expiryDate: new Date('2026-12-31') },
        { productId: 'PROD_002', deliveredQty: 50, batchNumber: 'BATCH_B1', expiryDate: new Date('2027-06-30') }
    ];
    
    const note = await pharmacyService.createDeliveryNote({
        tenantId: TENANT_ID,
        poId: po.id,
        noteId: 'BL_001',
        items: deliveryItems,
        userId: USER_ID
    });
    console.log("Delivery Note Created:", note.id);

    // Check PO Status (Should be RECEIVED?)
    const updatedPos = await pharmacyService.getPurchaseOrders(TENANT_ID);
    console.log("PO Status Update:", updatedPos[0].status);

    // Check Stock
    const stock = await pharmacyService.getInventory(TENANT_ID);
    console.log("Stock Items:", stock.length);
    const prod1Stock = stock.find(s => s.productId === 'PROD_001');
    console.log("PROD_001 Stock:", prod1Stock?.qtyUnits);
    
    if (prod1Stock?.qtyUnits !== 50) throw new Error("Stock Verification Failed (Expected 50)");

    // --- 3. REPLENISHMENT REQUEST ---
    console.log(`\n=== 3. REPLENISHMENT REQUEST ===`);
    const req = await pharmacyService.createReplenishmentRequest({
        tenantId: TENANT_ID,
        serviceId: 'SERVICE_A',
        items: [{ productId: 'PROD_001', quantity: 20 }],
        userId: USER_ID
    });
    console.log("Replenishment Request Created:", req.id);

    // Verify Read
    const reqs = await pharmacyService.getReplenishmentRequests(TENANT_ID);
    console.log("Requests Found:", reqs.length);

    // --- 4. DISPENSE REPLENISHMENT ---
    console.log(`\n=== 4. DISPENSE REPLENISHMENT ===`);
    // Dispense 20 from BATCH_A1
    await pharmacyService.updateReplenishmentRequestStatus(TENANT_ID, req.id, 'DISPENSED', {
        action: 'DISPENSE_ITEM',
        itemProductId: 'PROD_001',
        dispensedProductId: 'PROD_001',
        dispensedQuantity: 20,
        batches: [{
            productId: 'PROD_001',
            quantity: 20,
            batchNumber: 'BATCH_A1',
        }],
        userId: USER_ID
    });
    console.log("Replenishment Dispensed.");

    // Check Stock Decrease
    const finalStock = await pharmacyService.getInventory(TENANT_ID);
    const prod1Final = finalStock.find(s => s.productId === 'PROD_001');
    console.log("PROD_001 Final Stock:", prod1Final?.qtyUnits);

    if (prod1Final?.qtyUnits !== 30) throw new Error("Dispensation Verification Failed (Expected 30)");

    console.log("\n=== VERIFICATION SUCCESSFUL ===");
}

runVerification().catch(err => {
    console.error("VERIFICATION FAILED:", err);
    process.exit(1);
});
