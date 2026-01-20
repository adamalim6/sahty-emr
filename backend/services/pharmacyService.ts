import { v4 as uuidv4 } from 'uuid';
import { getTenantDB } from '../db/tenantDb';

export interface StockPosition {
    tenantId: string;
    productId: string;
    lot: string;
    expiry: Date;
    supplierId?: string;
    location: string;
    qtyUnits: number;
}

export interface Movement {
    movementId: string;
    tenantId: string;
    productId: string;
    lot: string;
    expiry: Date;
    qtyUnits: number;
    fromLocation?: string;
    toLocation?: string;
    supplierId?: string;
    documentType: string;
    documentId?: string;
    createdBy?: string;
    createdAt?: Date;
}

export class PharmacyService {
    private static instance: PharmacyService;

    private constructor() {}

    public static getInstance(): PharmacyService {
        if (!PharmacyService.instance) {
            PharmacyService.instance = new PharmacyService();
        }
        return PharmacyService.instance;
    }

    // --- 1. CORE STOCK QUERIES ---

    public async getStock(tenantId: string, location?: string, productId?: string): Promise<StockPosition[]> {
        let query = `SELECT * FROM current_stock WHERE tenant_id = ?`;
        const params: any[] = [tenantId];

        if (location) {
            query += ` AND location = ?`;
            params.push(location);
        }
        if (productId) {
            query += ` AND product_id = ?`;
            params.push(productId);
        }

        // Exclude 0 or negative stock from view (optional, but cleaner)
        query += ` AND qty_units > 0`;

        return this.get(tenantId, query, params).then(rows => rows.map((row: any) => ({
            tenantId: row.tenant_id,
            productId: row.product_id,
            lot: row.lot,
            expiry: new Date(row.expiry),
            supplierId: row.supplier_id,
            location: row.location,
            qtyUnits: row.qty_units
        })));
    }

    public async getMovements(tenantId: string, limit: number = 100): Promise<Movement[]> {
        const query = `
            SELECT * FROM inventory_movements 
            WHERE tenant_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?`;
        
        return this.get(tenantId, query, [tenantId, limit]).then(rows => rows.map((row: any) => ({
            movementId: row.movement_id,
            tenantId: row.tenant_id,
            productId: row.product_id,
            lot: row.lot,
            expiry: new Date(row.expiry),
            qtyUnits: row.qty_units,
            fromLocation: row.from_location,
            toLocation: row.to_location,
            supplierId: row.supplier_id,
            documentType: row.document_type,
            documentId: row.document_id,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at)
        })));
    }

    // --- 2. RECEPTION (QUARANTINE PROCESS) ---

    // Now called processReceipt to reflect SQL model
    public async processReceipt(params: {
        tenantId: string,
        items: any[], // Simple items: { productId, lot, expiry, qtyUnits, supplierId }
        location: string,
        documentId: string, // BL ID
        userId: string
    }): Promise<void> {
        const { tenantId, items, location, documentId, userId } = params;

        // Transaction simulation (Series of ops)
        const receiptId = documentId;
        
        await this.run(tenantId, `
            INSERT OR IGNORE INTO purchase_receipts (receipt_id, tenant_id, supplier_id, received_at, created_by)
            VALUES (?, ?, ?, datetime('now'), ?)
        `, [receiptId, tenantId, items[0]?.supplierId || 'UNKNOWN', userId]);

        for (const item of items) {
             const { productId, lot, expiry, qtyUnits, supplierId } = item;
             
             // 2a. Receipt Layer
             await this.run(tenantId, `
                INSERT INTO receipt_layers (receipt_id, tenant_id, product_id, lot, expiry, qty_received, qty_remaining)
                VALUES (?, ?, ?, ?, ?, ?, ?)
             `, [receiptId, tenantId, productId, lot, expiry, qtyUnits, qtyUnits]);

             // 2b. Movement
             const movementId = uuidv4();
             await this.run(tenantId, `
                INSERT INTO inventory_movements (
                    movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                    from_location, to_location, supplier_id, document_type, document_id, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             `, [movementId, tenantId, productId, lot, expiry, qtyUnits, 
                 'EXTERNAL', location, supplierId, 'DELIVERY', receiptId, userId]);

             // 2c. Upsert Stock
             await this.upsertStock(tenantId, productId, lot, expiry, location, qtyUnits, supplierId);
        }
    }

    // --- 3. DISPENSATION (FEFO) ---

    public async dispense(params: {
        tenantId: string,
        prescriptionId: string,
        admissionId: string,
        items: Array<{ productId: string, qtyRequested: number }>,
        sourceLocation: string,
        userId: string
    }): Promise<void> {
        const { tenantId, prescriptionId, admissionId, items, sourceLocation, userId } = params;

        for (const item of items) {
            let remaining = item.qtyRequested;

            // 1. Find Stock (FEFO)
            const available = await this.getStock(tenantId, sourceLocation, item.productId);
            // Sort by expiry
            available.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

            for (const position of available) {
                if (remaining <= 0) break;

                const take = Math.min(position.qtyUnits, remaining);
                
                // 2. Decrement Stock
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, sourceLocation, -take, position.supplierId);

                // 3. Log Movement
                const movementId = uuidv4();
                await this.run(tenantId, `
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, supplier_id, document_type, document_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [movementId, tenantId, position.productId, position.lot, position.expiry, -take, 
                    sourceLocation, 'DISPENSED', position.supplierId, 'DISPENSE', prescriptionId || admissionId, userId]);

                // 4. Clinical Event Sink
                const dispenseId = uuidv4();
                await this.run(tenantId, `
                    INSERT INTO medication_dispense_events (
                        dispense_id, tenant_id, admission_id, patient_id, product_id, lot, expiry, qty_units, 
                        source_location, prescription_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [dispenseId, tenantId, admissionId, 'PATIENT_TODO', position.productId, position.lot, position.expiry, take,
                    sourceLocation, prescriptionId, userId]);

                remaining -= take;
            }

            if (remaining > 0) {
                throw new Error(`Insufficient stock for product ${item.productId}. Missing ${remaining}.`);
            }
        }
    }

    // --- 4. REPLENISHMENT / TRANSFER ---

    public async transfer(params: {
        tenantId: string,
        fromLocation: string,
        toLocation: string,
        items: Array<{ productId: string, qty: number }>, // Auto-FEFO
        userId: string,
        documentId?: string
    }): Promise<void> {
        const { tenantId, fromLocation, toLocation, items, userId, documentId } = params;

        for (const item of items) {
            let remaining = item.qty;
            const available = await this.getStock(tenantId, fromLocation, item.productId);
            available.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

            for (const position of available) {
                if (remaining <= 0) break;
                const take = Math.min(position.qtyUnits, remaining);

                // Debit Source
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, fromLocation, -take, position.supplierId);
                // Credit Dest
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, toLocation, take, position.supplierId);

                // Movement
                const movementId = uuidv4();
                 await this.run(tenantId, `
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, supplier_id, document_type, document_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [movementId, tenantId, position.productId, position.lot, position.expiry, take, 
                    fromLocation, toLocation, position.supplierId, 'REPLENISHMENT', documentId || 'MANUAL_TRANSFER', userId]);

                remaining -= take;
            }
            if (remaining > 0) throw new Error(`Insufficient stock for transfer ${item.productId}`);
        }
    }


    // --- HELPERS ---

    private async run(tenantId: string, sql: string, params: any[] = []): Promise<void> {
        const db = await getTenantDB(tenantId);
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private async get<T>(tenantId: string, sql: string, params: any[] = []): Promise<T[]> {
        const db = await getTenantDB(tenantId);
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows as T[]);
            });
        });
    }

    private async upsertStock(tenantId: string, productId: string, lot: string, expiry: Date | string, location: string, deltaQty: number, supplierId: string = '') {
        // Date handling
        const expStr = typeof expiry === 'string' ? expiry : expiry.toISOString().split('T')[0];

        const sql = `
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, product_id, lot, location) 
            DO UPDATE SET qty_units = qty_units + excluded.qty_units
        `;

        await this.run(tenantId, sql, [tenantId, productId, lot, expStr, location, deltaQty, supplierId]);
    }

    // --- 5. LOCATIONS (SQL) ---

    // Return type Any to avoid importing legacy models if possible, or define interface
    public async getLocations(tenantId: string, serviceId?: string, scope?: 'PHARMACY' | 'SERVICE'): Promise<any[]> {
        console.log(`[getLocations] START tenant=${tenantId} service=${serviceId} scope=${scope}`);
        const db = await getTenantDB(tenantId);
        
        // 1. Fetch from 'locations' table (Pharmacy specific, or explicitly defined service stocks)
        let queryLoc = `SELECT location_id as id, name, type, scope, service_id FROM locations WHERE tenant_id = ?`;
        const paramsLoc: any[] = [tenantId];
        
        if (serviceId) {
            queryLoc += ` AND service_id = ?`;
            paramsLoc.push(serviceId);
        }
        if (scope) {
            queryLoc += ` AND scope = ?`;
            paramsLoc.push(scope);
        }

        const locations = await this.get(tenantId, queryLoc, paramsLoc).then(rows => {
            console.log(`[getLocations] LOCATIONS found: ${rows.length}`);
            return rows.map((r: any) => ({
                id: r.id,
                name: r.name,
                type: r.type,
                scope: r.scope,
                serviceId: r.service_id,
                tenantId: tenantId
            }));
        }).catch(err => {
            console.error(`[getLocations] LOCATIONS QUERY ERROR:`, err);
            throw err;
        });

        // 2. Fetch from 'service_units' table (Settings module) IF scope allows SERVICE
        // We consider service_units as valid stock locations for a service.
        if (!scope || scope === 'SERVICE') {
            console.log(`[getLocations] Querying service_units...`);
            let queryUnits = `SELECT id, name, type, service_id FROM service_units`;
            
            const paramsUnits: any[] = [];
            
            if (serviceId) {
                queryUnits += ` WHERE service_id = ?`;
                paramsUnits.push(serviceId);
            }

            try {
                // Execute query directly
                const rows = await new Promise<any[]>((resolve, reject) => {
                    db.all(queryUnits, paramsUnits, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                console.log(`[getLocations] SERVICE_UNITS found: ${rows.length}`);

                const serviceUnits = rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    type: 'WARD', // Default type for service units
                    scope: 'SERVICE',
                    serviceId: r.service_id,
                    tenantId: tenantId
                }));

                const final = [...locations, ...serviceUnits];
                console.log(`[getLocations] RETURNING TOTAL: ${final.length}`);
                return final;
            } catch (err) {
                 console.error(`[getLocations] SERVICE_UNITS QUERY ERROR:`, err);
                 // Don't crash entire call if settings module is borked
                 return locations;
            }
        }

        return locations;
    }

    public async addLocation(params: { tenantId: string, name: string, type: string, scope: string, serviceId?: string, id?: string }): Promise<any> {
        const id = params.id || `LOC-${Date.now()}`;
        await this.run(params.tenantId, `
            INSERT INTO locations (tenant_id, location_id, name, type, scope, service_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [params.tenantId, id, params.name, params.type, params.scope, params.serviceId || null]);
        return { ...params, id };
    }

    public async updateLocation(params: { tenantId: string, id: string, name?: string, type?: string }): Promise<any> {
        // Dynamic Update not easy with simple run, let's just do fixed fields or simplistic
        // Assuming full object passed usually
        await this.run(params.tenantId, `
            UPDATE locations SET name = COALESCE(?, name), type = COALESCE(?, type)
            WHERE tenant_id = ? AND location_id = ?
        `, [params.name, params.type, params.tenantId, params.id]);
        return params;
    }

    public async deleteLocation(tenantId: string, locationId: string): Promise<void> {
        await this.run(tenantId, `DELETE FROM locations WHERE tenant_id = ? AND location_id = ?`, [tenantId, locationId]);
    }

    // --- 6. SUPPLIERS (SQL) ---

    public async getSuppliers(tenantId: string): Promise<any[]> {
        return this.get(tenantId, `SELECT * FROM suppliers WHERE tenant_id = ?`, [tenantId]).then(rows => rows.map((r: any) => ({
             id: r.supplier_id,
             name: r.name,
             email: r.email,
             phone: r.phone,
             address: r.address,
             tenantId: r.tenant_id
        })));
    }

    public async addSupplier(params: { tenantId: string, name: string, email?: string, phone?: string, address?: string, id?: string }): Promise<any> {
        const id = params.id || `SUP-${Date.now()}`;
        await this.run(params.tenantId, `
            INSERT INTO suppliers (tenant_id, supplier_id, name, email, phone, address)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [params.tenantId, id, params.name, params.email, params.phone, params.address]);
        return { ...params, id };
    }

    public async updateSupplier(params: { tenantId: string, id: string, name?: string, email?: string, phone?: string, address?: string }): Promise<any> {
        await this.run(params.tenantId, `
            UPDATE suppliers SET name = ?, email = ?, phone = ?, address = ?
            WHERE tenant_id = ? AND supplier_id = ?
        `, [params.name, params.email, params.phone, params.address, params.tenantId, params.id]);
        return params;
    }

    public async deleteSupplier(tenantId: string, supplierId: string): Promise<void> {
        await this.run(tenantId, `DELETE FROM suppliers WHERE tenant_id = ? AND supplier_id = ?`, [tenantId, supplierId]);
    }

    // --- 7. PARTNERS (Mocked/Stubbed or using Suppliers table with type, or separate logic) ---
    // For now, let's stub it or map to empty. The usage in controller is getPartners(tenantId).
    public async getPartners(tenantId: string): Promise<any[]> {
        return []; // TODO: Implement Partners table if needed
    }
    public async addPartner(params: any): Promise<any> { return params; }
    public async updatePartner(params: any): Promise<any> { return params; }
    public async deletePartner(tenantId: string, id: string): Promise<void> {}

    // --- 8. CATALOG PROXY (Legacy JSON Bridge) ---
    // The controller calls pharmacyService.updateProductConfig
    // We import tenantCatalogService to handle this.
    
    public updateProductConfig(tenantId: string, productId: string, config: any, context?: any) {
        // We need to import tenantCatalogService at module level or here
        // Assuming it's imported at top
        const { tenantCatalogService } = require('./tenantCatalogService'); 
        return tenantCatalogService.upsertProductConfig(tenantId, {
            productId,
            enabled: config.enabled,
            suppliers: config.suppliers // Maps roughly
        }, context);
    }
    
    public getProductById(tenantId: string, id: string) {
        // Proxy to global
        const { globalProductService } = require('./globalProductService');
        return globalProductService.getProductById(id);
    }
    
    // Legacy support for controller
    public getStockOutHistory(tenantId: string) { return []; }
    public async getPurchaseOrders(tenantId: string): Promise<any[]> {
        const pos = await this.get(tenantId, `SELECT * FROM purchase_orders WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId]);
        
        // Fetch items for each PO (N+1 but minimal for typical list size, or optimize with join)
        for (const po of pos as any[]) {
            po.items = await this.get(tenantId, `SELECT * FROM po_items WHERE tenant_id = ? AND po_id = ?`, [tenantId, po.po_id]);
        }
        return pos.map((p: any) => ({
            id: p.po_id,
            tenantId: p.tenant_id,
            supplierId: p.supplier_id,
            status: p.status,
            date: new Date(p.created_at),
            items: p.items.map((i: any) => ({
                productId: i.product_id,
                orderedQty: i.qty_ordered,
                unitPrice: i.unit_price
            }))
        }));
    }

    public async createPurchaseOrder(params: any): Promise<any> {
        const { tenantId, supplierId, items, userId } = params;
        const poId = params.id || `PO-${Date.now()}`;
        
        await this.run(tenantId, `
            INSERT INTO purchase_orders (po_id, tenant_id, supplier_id, status, created_by)
            VALUES (?, ?, ?, 'ORDERED', ?)
        `, [poId, tenantId, supplierId, userId]);

        for (const item of items) {
            await this.run(tenantId, `
                INSERT INTO po_items (po_id, tenant_id, product_id, qty_ordered, unit_price)
                VALUES (?, ?, ?, ?, ?)
            `, [poId, tenantId, item.productId, item.orderedQty, item.unitPrice]);
        }
        return { ...params, id: poId, status: 'ORDERED' };
    }

    public async getDeliveryNotes(tenantId: string): Promise<any[]> {
        const receipts = await this.get(tenantId, `SELECT * FROM purchase_receipts WHERE tenant_id = ? ORDER BY received_at DESC`, [tenantId]);
        // Get details
        for (const r of receipts as any[]) {
             const layers = await this.get(tenantId, `SELECT * FROM receipt_layers WHERE tenant_id = ? AND receipt_id = ?`, [tenantId, r.receipt_id]);
             r.items = layers.map((l: any) => ({
                 productId: l.product_id,
                 deliveredQty: l.qty_received,
                 batchNumber: l.lot,
                 expiryDate: l.expiry
             }));
        }
        return receipts.map((r: any) => ({
            id: r.receipt_id,
            date: new Date(r.received_at),
            items: r.items,
            createdBy: r.created_by
        }));
    }

    public async createDeliveryNote(params: any): Promise<any> {
        // params: { tenantId, poId, noteId, items: [ { productId, deliveredQty, batchNumber, expiryDate } ], userId }
        const { tenantId, poId, noteId, items, userId } = params;
        
        // 1. Process Receipt (Stock + Movements)
        // Need to map simple items to what processReceipt expects (qtyUnits instead of deliveredQty)
        const receiptItems = items.map((i: any) => ({
            productId: i.productId,
            lot: i.batchNumber,
            expiry: i.expiryDate,
            qtyUnits: i.deliveredQty, // Map Name
            supplierId: 'UNKNOWN' // Will limit functionality if not passed, maybe fetch PO?
        }));

        // Try to get Supplier from PO
        if (poId) {
             const result = await this.get(tenantId, `SELECT supplier_id FROM purchase_orders WHERE po_id = ?`, [poId]);
             const po: any = result[0];
             if (po) {
                 receiptItems.forEach((i: any) => i.supplierId = po.supplier_id);
                 // Update PO status
                 await this.run(tenantId, `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = CURRENT_TIMESTAMP WHERE po_id = ?`, [poId]);
             }
        }

        await this.processReceipt({
            tenantId,
            items: receiptItems,
            location: 'PHARMACY_MAIN', // Default
            documentId: noteId,
            userId
        });
        
        return { id: noteId, ...params };
    }

    public processQuarantine(params: any) {
         // Proxy to processReceipt
         // Logic bridge: Map params to items
         // params might be { items: [{ productId, batches: [{ batchNumber, expiryDate, quantity, locationId}] }], ... }
         // We need to flatten batches to items
         
         const items: any[] = [];
         params.items.forEach((i: any) => {
             i.batches.forEach((b: any) => {
                 items.push({
                     productId: i.productId,
                     lot: b.batchNumber,
                     expiry: b.expiryDate,
                     qtyUnits: b.quantity,
                     supplierId: 'UNKNOWN' // TODO: extract from params
                 });
             });
         });
         
         const location = items[0]?.location || 'PHARMACY_MAIN'; // TODO: extract
         
         return this.processReceipt({
             tenantId: params.tenantId,
             items,
             location,
             documentId: params.noteId || `BL-${Date.now()}`,
             userId: params.processedBy || 'SYSTEM'
         });
    }

    public async getReplenishmentRequests(tenantId: string): Promise<any[]> {
        const reqs = await this.get(tenantId, `SELECT * FROM replenishment_requests WHERE tenant_id = ? ORDER BY created_at DESC`, [tenantId]);
        for (const r of reqs as any[]) {
            const items = await this.get(tenantId, `SELECT * FROM replenishment_items WHERE tenant_id = ? AND request_id = ?`, [tenantId, r.request_id]);
            r.items = items.map((i: any) => ({
                productId: i.product_id,
                quantityRequested: i.qty_requested, // Map to old name
                qtyDispensed: i.qty_dispensed
            }));
        }
        return reqs.map((r: any) => ({
            id: r.request_id,
            serviceId: r.service_id,
            status: r.status,
            date: new Date(r.created_at),
            items: r.items,
            requestedBy: r.requested_by
        }));
    }

    public async createReplenishmentRequest(params: any): Promise<any> {
        const { tenantId, serviceId, items, userId } = params; // items: [{ productId, quantity }]
        const requestId = params.id || `REQ-${Date.now()}`;
        
        await this.run(tenantId, `
            INSERT INTO replenishment_requests (request_id, tenant_id, service_id, status, requested_by)
            VALUES (?, ?, ?, 'PENDING', ?)
        `, [requestId, tenantId, serviceId, userId]);

        for (const item of items) {
             await this.run(tenantId, `
                INSERT INTO replenishment_items (request_id, tenant_id, product_id, qty_requested)
                VALUES (?, ?, ?, ?)
             `, [requestId, tenantId, item.productId, item.quantity || item.qtyRequested]); // Handle alias
        }
        return { id: requestId, ...params, status: 'PENDING' };
    }

    public async updateReplenishmentRequestStatus(tenantId: string, id: string, status: string, data: any): Promise<any> {
        // Handle explicit Dispense Action
        if (status === 'DISPENSED' && data?.action === 'DISPENSE_ITEM') {
             const { itemProductId, dispensedQuantity, batches, userId } = data;
             
             // 1. Dispense from Stock
             const dispenseBatches = batches || [];
             for (const batch of dispenseBatches) {
                 await this.dispense({
                     tenantId,
                     prescriptionId: '', 
                     admissionId: 'REPLENISHMENT', // misuse field context
                     items: [{ 
                        productId: batch.productId || data.dispensedProductId, 
                        qtyRequested: batch.quantity 
                     }],
                     sourceLocation: 'PHARMACY_MAIN',
                     userId: userId || 'SYSTEM'
                 });
             }

             // 2. Update Replenishment Item Counter
             // We need to increment qty_dispensed for the REQUESTED item (itemProductId)
             await this.run(tenantId, `
                UPDATE replenishment_items 
                SET qty_dispensed = qty_dispensed + ?
                WHERE request_id = ? AND product_id = ?
             `, [dispensedQuantity, id, itemProductId]);

             // Update Request Status to IN_PROGRESS if not already
             await this.run(tenantId, `UPDATE replenishment_requests SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [id]);
             
             return { id, status: 'IN_PROGRESS' };
        }

        // Default Status Update
        await this.run(tenantId, `UPDATE replenishment_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`, [status, id]);
        return { id, status };
    }
    
    public dispenseFromServiceStock(params: any) { return {}; }
    public logMovement(tenantId: string, log: any) {}
    public getMovementLogs(tenantId: string) { return []; } // Used by controller
    
    public getSerializedPacks(params: any) { return []; }
    public getSerializedPackById(t: string, id: string) { return undefined; }
    public getLooseUnits(t: string, productId?: string, serviceId?: string) { return []; }
    
    public createReturnRequest(t: string, r: any) { return r; }
    public getReturnRequests(t: string, aid?: string) { return []; }
    public processReturnDecision(t: string, id: string, d: string, u: string) {}
    public addContainer(t: string, c: any) {}
    
    public initServiceLedger(t: string, s: string) {} // Stub

    // --- WRAPPERS & ALIASES ---

    public async dispenseWithFEFO(params: any): Promise<any> {
        // Alias to dispense, ignoring mode
        return this.dispense({
            ...params,
            items: [{ productId: params.productId, qtyRequested: params.quantity }],
            sourceLocation: 'PHARMACY_MAIN' // Default for now
        });
    }

    public async getInventory(tenantId: string): Promise<any[]> {
        return this.getStock(tenantId).then(rows => rows.map(r => ({
            ...r,
            theoreticalQty: r.qtyUnits,
            actualQty: r.qtyUnits,
            name: 'MAPPED_FROM_SQL', // TODO: Join with Product Name
            batchNumber: r.lot,
            expiryDate: r.expiry
        })));
    }

    // --- CATALOG (Restored) ---


    public async getCatalogPaginated(tenantId: string, page: number, limit: number, query: string = '', status: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL') {
        const { globalProductService } = require('./globalProductService');
        const { tenantCatalogService } = require('./tenantCatalogService');
        const { globalSupplierService } = require('./globalSupplierService');

        // 1. Determine Filtering Strategy
        const tenantConfig = await tenantCatalogService.getCatalogConfig(tenantId); // Assuming this might be async too? Check. 
        // If tenantCatalogService uses TenantStore (JSON), it's sync. If it uses SQL, it might be async.
        // I haven't checked tenantCatalogService. Let's assume sync for now but it's safer to not await if uncertain, unless I check.
        // Wait, if it IS sync, awaiting a non-promise value is fine in JS (resolves to value).
        
        let idsFilter: string[] | undefined;
        
        if (status === 'ACTIVE') {
            idsFilter = tenantConfig.filter((tc: any) => tc.enabled).map((tc: any) => tc.productId);
        }

        // 2. Fetch Paginated Global Definitions (ASYNC)
        const { data: globalProducts, total, totalPages } = await globalProductService.getProductsPaginated(page, limit, query, idsFilter);

        // 3. Fetch Suppliers (SQL + Global) (ASYNC)
        const tenantSuppliers = await this.getSuppliers(tenantId);
        const globalSuppliers = await globalSupplierService.getAll();
        const allSuppliers = [...globalSuppliers, ...tenantSuppliers];

        // 4. Merge Chunk
        const mergedProducts = globalProducts.map((gp: any) => {
            const config = tenantConfig.find((tc: any) => tc.productId === gp.id);
            
            const productSuppliers = (config?.suppliers || []).map((link: any) => {
                const supplierDef = allSuppliers.find((s: any) => s.id === link.supplierId);
                if (!supplierDef) return null;
                const activeVer = (link.priceVersions || []).find((v: any) => !v.validTo);
                return {
                    id: link.supplierId,
                    name: supplierDef.name,
                    purchasePrice: activeVer?.purchasePrice || 0,
                    margin: activeVer?.margin || 0,
                    vat: activeVer?.vat || 0,
                    isDefault: link.isDefault || false,
                    isActive: link.isActive,
                    priceVersions: link.priceVersions || []
                };
            }).filter((s: any) => s !== null);

            return {
                ...gp,
                suppliers: productSuppliers,
                profitMargin: (config?.suppliers.find((s: any)=>s.isDefault)?.priceVersions.find((v: any)=>!v.validTo)?.margin) || 0,
                vatRate: (config?.suppliers.find((s: any)=>s.isDefault)?.priceVersions.find((v: any)=>!v.validTo)?.vat) || 0,
                isEnabled: config?.enabled ?? false,
                tenantId
            };
        });

        return { data: mergedProducts, total, page, totalPages };
    }


    public async getCatalog(tenantId: string): Promise<any[]> {
        const { globalProductService } = require('./globalProductService');
        const globalProducts = await globalProductService.getAllProducts();
        // Simple map for now, full logic above if needed
        return globalProducts.map((p: any) => ({ ...p, tenantId }));
    }

    public async getDispensationsByPrescription(tenantId: string, prescriptionId: string): Promise<any[]> {
        return this.get(tenantId, `SELECT * FROM medication_dispense_events WHERE tenant_id = ? AND prescription_id = ?`, [tenantId, prescriptionId]);
    }

    public async getDispensationsByAdmission(tenantId: string, admissionId: string): Promise<any[]> {
        return this.get(tenantId, `SELECT * FROM medication_dispense_events WHERE tenant_id = ? AND admission_id = ?`, [tenantId, admissionId]);
    }
    public async resetDB(tenantId: string): Promise<void> {
        // Dev only: Wipes inventory data for tenant? Or all?
        // Since sqlite is shared, maybe only for tenant. But "Clean DB state" implies full wipe often.
        // Let's wipe by tenant to be safe.
        // Tables: current_stock, inventory_movements, purchase_receipts, receipt_layers, supplier_returns, return_lines, medication_dispense_events
        // Locations/Suppliers could be kept? User said "truncate new tables".
        
        await this.run(tenantId, `DELETE FROM current_stock WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM inventory_movements WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM receipt_layers WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM purchase_receipts WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM supplier_return_lines WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM supplier_returns WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM medication_dispense_events WHERE tenant_id = ?`, [tenantId]);
        // Also wipe locations/suppliers if requested? "Clean state". Maybe not.
    }
}

export const pharmacyService = PharmacyService.getInstance();
