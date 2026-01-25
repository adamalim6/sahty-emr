
const { Database } = require('sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TENANT_ID = 'test_tenant_verification';
const DB_PATH = path.join(process.cwd(), 'backend/data', `client_${Date.now()}.db`);
const fs = require('fs');

import { PharmacyService } from '../services/pharmacyService';
import { getTenantDB } from '../db/tenantDb';

async function main() {
    console.log("--- START VERIFICATION: Blind Reception Flow (Renamed Delivery Notes) ---");

    const tenantId = 'verify_flow_' + Date.now();
    
    // 1. Init DB
    const db = await getTenantDB(tenantId);
    const schemaPath = path.join(process.cwd(), 'backend/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    await new Promise<void>((resolve, reject) => {
        db.exec(schemaSql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log("DB Initialized and Schema Applied.");

    const service = PharmacyService.getInstance();
    const userId = 'tester';
    const productId = 'prod-123';

    // 2. Create PO
    console.log("Creating Purchase Order...");
    const po = await service.createPurchaseOrder({
        tenantId,
        supplierId: 'sup-1',
        items: [{ productId, orderedQty: 10, unitPrice: 100 }],
        userId
    });
    console.log("PO Created:", po.id);

    // 3. Create Delivery Note (Reception)
    console.log("Creating Delivery Note (Reception)...");
    const noteId = `BL-${Date.now()}`;
    const dlPayload = {
        id: noteId, 
        tenantId,
        poId: po.id,
        items: [{
            productId,
            deliveredQty: 5,
            // NO batchNumber, NO expiryDate for blind reception
        }],
        userId
    };

    const result = await service.createDeliveryNote(dlPayload);
    console.log("Delivery Note Created:", result);

    // 4. Verify DB
    console.log("Verifying Database Entries...");

    // Check Delivery Notes (Header) - RENAMED FROM purchase_receipts
    const receiptFn = () => new Promise<any>((res, rej) => {
        db.get(`SELECT * FROM delivery_notes WHERE delivery_note_id = ?`, [noteId], (err, row) => err ? rej(err) : res(row));
    });
    const note = await receiptFn();
    console.log("Delivery Note Header:", note ? "OK" : "MISSING", note);
    
    // NEW: Check PO ID Link
    if (!note) throw new Error("Delivery Note Header Missing!");
    if (note.po_id !== po.id) throw new Error(`Delivery Note PO ID Mismatch: ${note.po_id} vs ${po.id}`);

    // Check Delivery Note Items (Pending/Quarantine) - RENAMED FROM purchase_receipt_items
    const itemsFn = () => new Promise<any[]>((res, rej) => {
        db.all(`SELECT * FROM delivery_note_items WHERE delivery_note_id = ?`, [noteId], (err, rows) => err ? rej(err) : res(rows));
    });
    const noteItems = await itemsFn();
    console.log("Delivery Note Items:", noteItems.length);

    if (noteItems.length !== 1) throw new Error("Delivery Note Items Missing or Incorrect Count!");
    if (noteItems[0].qty_pending !== 5) throw new Error(`Incorrect Quantity Pending: ${noteItems[0].qty_pending} vs 5`);
    
    // NEW: Check PO Item Qty Persistence
    const poItemFn = () => new Promise<any>((res, rej) => {
        db.get(`SELECT * FROM po_items WHERE po_id = ? AND product_id = ?`, [po.id, productId], (err, row) => err ? rej(err) : res(row));
    });
    const poItem = await poItemFn();
    console.log("PO Item Updates:", poItem);
    
    if (poItem.qty_delivered !== 5) throw new Error(`PO Item Qty Delivered Not Updated: ${poItem.qty_delivered}`); 
    if (poItem.qty_to_be_delivered !== 5) throw new Error(`PO Item Qty Remaining Not Updated: ${poItem.qty_to_be_delivered}`); 

    console.log("--- SUCCESS: Verification Passed ---");
}

main().catch(console.error);
