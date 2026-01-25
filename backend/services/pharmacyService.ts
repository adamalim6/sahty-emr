import { v4 as uuidv4 } from 'uuid';
import { getTenantDB } from '../db/tenantDb';

export interface StockPosition {
    tenantId: string;
    productId: string;
    lot: string;
    expiry: Date;
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
            // supplierId: NOT STORED ANYMORE
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
            documentType: row.document_type,
            documentId: row.document_id,
            createdBy: row.created_by,
            createdAt: new Date(row.created_at)
        })));
    }

    // --- 2. RECEPTION (QUARANTINE PROCESS) ---

    // Now called processReceipt to reflect SQL model
    // Now called processDeliveryNote to reflect SQL model
    public async processDeliveryNote(params: {
        tenantId: string,
        items: any[],
        location: string,
        documentId: string, // BL ID
        userId: string,
        poId?: string // Optional link to PO
    }): Promise<void> {
        const { tenantId, items, location, documentId, userId, poId } = params;

        // Transaction simulation (Series of ops)
        const deliveryNoteId = documentId;
        
        await this.run(tenantId, `
            INSERT OR IGNORE INTO delivery_notes (delivery_note_id, tenant_id, supplier_id, po_id, received_at, created_by)
            VALUES (?, ?, ?, ?, datetime('now'), ?)
        `, [deliveryNoteId, tenantId, items[0]?.supplierId || 'UNKNOWN', poId || null, userId]);

        for (const item of items) {
             const qty = item.qtyPending || item.qtyUnits || 0;
             const { productId } = item;
             
             // NEW FLOW: Insert into delivery_note_items (Quarantine/Pending Verification)
             // No Lot/Expiry required at this stage.
             await this.run(tenantId, `
                INSERT INTO delivery_note_items (id, tenant_id, delivery_note_id, product_id, qty_pending, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             `, [uuidv4(), tenantId, deliveryNoteId, productId, qty]);
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
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, sourceLocation, -take);

                // 3. Log Movement
                const movementId = uuidv4();
                await this.run(tenantId, `
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, document_type, document_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [movementId, tenantId, position.productId, position.lot, position.expiry, -take, 
                    sourceLocation, 'DISPENSED', 'DISPENSE', prescriptionId || admissionId, userId]);

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
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, fromLocation, -take);
                // Credit Dest
                await this.upsertStock(tenantId, position.productId, position.lot, position.expiry, toLocation, take);

                // Movement
                const movementId = uuidv4();
                 await this.run(tenantId, `
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, document_type, document_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [movementId, tenantId, position.productId, position.lot, position.expiry, take, 
                    fromLocation, toLocation, 'REPLENISHMENT', documentId || 'MANUAL_TRANSFER', userId]);

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

    private async upsertStock(tenantId: string, productId: string, lot: string, expiry: Date | string, location: string, deltaQty: number) {
        // Date handling
        const expStr = typeof expiry === 'string' ? expiry : expiry.toISOString().split('T')[0];

        const sql = `
            INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, product_id, lot, location) 
            DO UPDATE SET qty_units = qty_units + excluded.qty_units
        `;

        await this.run(tenantId, sql, [tenantId, productId, lot, expStr, location, deltaQty]);
    }

    // --- 5. LOCATIONS (SQL) ---

    // Return type Any to avoid importing legacy models if possible, or define interface
    public async getLocations(tenantId: string, serviceId?: string, scope?: 'PHARMACY' | 'SERVICE'): Promise<any[]> {
        console.log(`[getLocations] START tenant=${tenantId} service=${serviceId} scope=${scope}`);
        const db = await getTenantDB(tenantId);
        
        // 1. Fetch from 'locations' table (Pharmacy specific, or explicitly defined service stocks)
        let queryLoc = `SELECT location_id as id, name, type, scope, service_id, status FROM locations WHERE tenant_id = ?`;
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
                status: r.status || 'ACTIVE',
                isActive: (r.status === 'ACTIVE' || !r.status), // Map to frontend boolean
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
                    status: 'ACTIVE', // Service units are always active structurally
                    isActive: true,
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

    public async addLocation(params: { tenantId: string, name: string, type: string, scope: string, serviceId?: string, id?: string, status?: string, isActive?: boolean }): Promise<any> {
        const id = params.id || `LOC-${Date.now()}`;
        const status = params.status || (params.isActive !== undefined ? (params.isActive ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE');
        
        await this.run(params.tenantId, `
            INSERT INTO locations (tenant_id, location_id, name, type, scope, service_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [params.tenantId, id, params.name, params.type, params.scope, params.serviceId || null, status]);
        return { ...params, id, status, isActive: status === 'ACTIVE' };
    }

    public async updateLocation(params: { tenantId: string, id: string, name?: string, type?: string, status?: string, isActive?: boolean }): Promise<any> {
        // Map isActive to status if provided
        let status = params.status;
        if (params.isActive !== undefined) {
            status = params.isActive ? 'ACTIVE' : 'INACTIVE';
        }

        await this.run(params.tenantId, `
            UPDATE locations SET name = COALESCE(?, name), type = COALESCE(?, type), status = COALESCE(?, status)
            WHERE tenant_id = ? AND location_id = ?
        `, [params.name, params.type, status, params.tenantId, params.id]);
        return { ...params, status, isActive: status === 'ACTIVE' };
    }

    public async deleteLocation(tenantId: string, locationId: string): Promise<void> {
        // SAFETY CHECK: Prevent deletion if stock exists
        const stockCount = await this.get<any>(tenantId, `SELECT COUNT(*) as count FROM current_stock WHERE location = ? AND qty_units > 0`, [locationId]).then(r => r[0].count);
        
        if (stockCount > 0) {
            throw new Error(`Impossible de supprimer l'emplacement : Il contient ${stockCount} lots de stock.`);
        }

        await this.run(tenantId, `DELETE FROM locations WHERE tenant_id = ? AND location_id = ?`, [tenantId, locationId]);
    }

    // --- 6. SUPPLIERS (SQL) ---

    public async getSuppliers(tenantId: string): Promise<any[]> {
        const { globalSupplierService } = require('./globalSupplierService');
        
        // 1. Fetch Local
        const localSuppliers = await this.get(tenantId, `SELECT * FROM suppliers WHERE tenant_id = ?`, [tenantId]).then(rows => rows.map((r: any) => ({
             id: r.supplier_id,
             name: r.name,
             email: r.email,
             phone: r.phone,
             address: r.address,
             tenantId: r.tenant_id,
             source: 'LOCAL',
             isActive: true // Assuming local are active by default or add column if exists
        })));

        // 2. Fetch Global
        const globalSuppliersRaw = await globalSupplierService.getAll();
        const globalSuppliers = globalSuppliersRaw.map((g: any) => ({
            id: g.id,
            name: g.name,
            email: g.email,
            phone: g.phone,
            address: g.address,
            tenantId: 'GLOBAL',
            source: 'GLOBAL',
            isActive: g.isActive
        }));

        // 3. Merge
        return [...globalSuppliers, ...localSuppliers];
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

    public async updateProductConfig(tenantId: string, config: any) {
        // config has structure: { id (productId), suppliers: [ { id, purchasePrice, margin, vat, isActive, ... } ], reason: "Inflation", ... }
        
        const now = new Date().toISOString();
        const reason = config.reason || '-'; // Capture reason
        const productId = config.id; // Extract productId from config

        try {
            console.log(`[PharmacyService] updateProductConfig called.`);
            console.log(`[PharmacyService] Tenant: ${tenantId}, Product: ${productId}`);
             // console.log(`[PharmacyService] Config Payload:`, JSON.stringify(config, null, 2));

            // SQL IMPLEMENTATION (Removes JSON dependency)
            // 1. Upsert Product Config
            await this.run(tenantId, `
                INSERT INTO product_configs (tenant_id, product_id, is_enabled, min_stock, max_stock, security_stock, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(tenant_id, product_id) DO UPDATE SET
                    is_enabled = excluded.is_enabled,
                    min_stock = excluded.min_stock,
                    max_stock = excluded.max_stock,
                    security_stock = excluded.security_stock,
                    updated_at = CURRENT_TIMESTAMP
            `, [tenantId, productId, (config.isEnabled !== undefined ? config.isEnabled : config.enabled) ? 1 : 0, config.minStock || 0, config.maxStock || 0, config.securityStock || 0]);

            // 2. Handle Suppliers
            // config.suppliers = [{ supplierId, purchasePrice, margin, vat, salesPrice, isActive ... }]
            for (const s of config.suppliers || []) {
                const isActive = s.isActive !== undefined ? (s.isActive ? 1 : 0) : 1;
                // FIX: Frontend sends 'id', not 'supplierId' sometimes
                const supplierId = s.id || s.supplierId;
                const supplierLinkParams = [tenantId, productId, supplierId, s.source || 'GLOBAL', isActive];
                
                // Upsert Supplier Link to get ID
                // Check existence first to get ID
                const existingLink = await this.get(tenantId, `SELECT id FROM product_suppliers WHERE tenant_id = ? AND product_id = ? AND supplier_id = ?`, [tenantId, productId, supplierId]).then(r => r[0] as any);
                let linkId = existingLink?.id;

                if (!linkId) {
                    linkId = uuidv4();
                    await this.run(tenantId, `INSERT INTO product_suppliers (id, tenant_id, product_id, supplier_id, supplier_type, is_active) VALUES (?, ?, ?, ?, ?, ?)`, [linkId, ...supplierLinkParams]);
                } else {
                    // Update status if changed
                    await this.run(tenantId, `UPDATE product_suppliers SET is_active = ? WHERE id = ?`, [isActive, linkId]);
                }

                // 3. Price Versioning
                // Check active version
                const activeVer = await this.get(tenantId, `SELECT * FROM product_price_versions WHERE product_supplier_id = ? AND valid_to IS NULL`, [linkId]).then(r => r[0] as any);

                // Detect Change
                let newPurchase = parseFloat(s.purchasePrice || 0);
                let newMargin = parseFloat(s.margin || 0);
                let newVat = parseFloat(s.vat || 0);
                
                // FORCE CALCULATION (Backend is source of truth)
                // HT = Purchase * (1 + Margin/100)
                // Fetch Global Product EARLY for PH Lock Logic
                const globalProduct = await this.getProductById(tenantId, productId);
                // FORCE CALCULATION (Backend is source of truth)
                // HT = Purchase * (1 + Margin/100)
                const calculatedHT = newPurchase * (1 + newMargin / 100);
                // TTC = HT * (1 + VAT/100)
                const calculatedTTC = calculatedHT * (1 + newVat / 100);

                let newSaleHT = parseFloat(calculatedHT.toFixed(4));
                let newSaleTTC = parseFloat(calculatedTTC.toFixed(4));
                
                // PH LOCK (Moroccan Medicament Regulation)
                // If product has a fixed Hospital Price (PH), it strictly overrides the calculated TTC.
                // Accept 'MEDICAMENT' or 'Médicament' (legacy data compatibility)
                if ((globalProduct?.type === 'MEDICAMENT' || globalProduct?.type === 'Médicament') && globalProduct.marketInfo?.ph && globalProduct.marketInfo.ph > 0) {
                    const ph = Number(globalProduct.marketInfo.ph);
                    // Only override if meaningful difference or strict enforcement
                    if (Math.abs(newSaleTTC - ph) > 0.001) {
                         // Lock TTC
                         newSaleTTC = ph;
                         // Reverse Calculate HT
                         newSaleHT = parseFloat((newSaleTTC / (1 + newVat / 100)).toFixed(4));
                         // Reverse Calculate Margin (This effectively ignores user input margin if it contradicts PH)
                         if (newPurchase > 0) {
                             newMargin = parseFloat((((newSaleHT / newPurchase) - 1) * 100).toFixed(4));
                         }
                    } else {
                        // Even if close, strictly snap to PH for cleanliness
                         newSaleTTC = ph;
                    }
                }

                const hasChanged = !activeVer || 
                    activeVer.purchase_price !== newPurchase || 
                    activeVer.margin !== newMargin || 
                    activeVer.vat !== newVat ||
                    activeVer.sale_price_ttc !== newSaleTTC;

                if (hasChanged) {
                    const unitsPerBox = globalProduct?.unitsPerBox || 1;
                    const newUnitSalePrice = unitsPerBox > 0 ? (newSaleTTC / unitsPerBox) : 0;

                    // Close ALL old/active versions -> ARCHIVED
                    // This creates a self-healing mechanism for duplicate active rows
                    await this.run(tenantId, `
                        UPDATE product_price_versions 
                        SET valid_to = CURRENT_TIMESTAMP, change_reason = ?, status = 'ARCHIVED' 
                        WHERE product_supplier_id = ? AND (status = 'ACTIVE' OR valid_to IS NULL)
                    `, [reason, linkId]);

                    const priceParams = [
                        uuidv4(), tenantId, linkId, 
                        newPurchase, newMargin, newVat, 
                        newSaleHT, newSaleTTC, newUnitSalePrice, 
                        config.userId || 'SYSTEM', 
                        '',       // change_reason (empty string for active)
                        'ACTIVE'  // status
                    ];
                    
                    await this.run(tenantId, `
                        INSERT INTO product_price_versions (
                            id, tenant_id, product_supplier_id, 
                            purchase_price, margin, vat, 
                            sale_price_ht, sale_price_ttc, unit_sale_price, 
                            created_by, change_reason, status
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, priceParams);
                }
            }
            
            // Return Updated Product Object (Critical for Frontend)
            return this.getProductConfig(tenantId, productId);
        } catch (error: any) {
            console.error('[PharmacyService] CRITICAL SQL ERROR in updateProductConfig:', error);
            throw error;
        }
    }
    
    public async getProductConfig(tenantId: string, productId: string) {
        const { globalProductService } = require('./globalProductService');
        const { globalSupplierService } = require('./globalSupplierService');

        // 1. Global Product
        const globalProduct = await globalProductService.getProductById(productId);
        if (!globalProduct) throw new Error("Global Product Not Found");

        // 2. Tenant Config
        const config = await this.get<any>(tenantId, `SELECT * FROM product_configs WHERE tenant_id = ? AND product_id = ?`, [tenantId, productId])
            .then(r => r[0]);

        // 3. Suppliers & Active Prices
        const dbSuppliers = await this.get<any>(tenantId, `
            SELECT ps.id, ps.tenant_id, ps.product_id, ps.supplier_id, ps.supplier_type, ps.is_active,
                   ppv.id as ppv_id,
                   ppv.purchase_price as v_purchase_price, 
                   ppv.margin as v_margin, 
                   ppv.vat as v_vat, 
                   ppv.sale_price_ttc as v_sale_price_ttc, 
                   ppv.sale_price_ht as v_sale_price_ht,
                   ppv.unit_sale_price as v_unit_sale_price
            FROM product_suppliers ps
            LEFT JOIN product_price_versions ppv ON ps.id = ppv.product_supplier_id AND ps.tenant_id = ppv.tenant_id AND (ppv.status = 'ACTIVE' OR ppv.valid_to IS NULL)
            WHERE ps.tenant_id = ? AND ps.product_id = ?
        `, [tenantId, productId]);

        // 4. Resolve Supplier Names
        const tenantLocalSuppliers = await this.get<any>(tenantId, `SELECT * FROM suppliers WHERE tenant_id = ?`, [tenantId]);
        const globalSupplierDefs = await globalSupplierService.getAll();
        const allSuppliers = [...globalSupplierDefs, ...tenantLocalSuppliers];

        const mappedSuppliers = await Promise.all(dbSuppliers.map(async (s: any) => {
             // Name
             let def;
             if (s.supplier_type === 'LOCAL') {
                 def = tenantLocalSuppliers.find((l: any) => l.supplier_id === s.supplier_id);
             } else {
                 def = allSuppliers.find((g: any) => g.id === s.supplier_id);
             }

             // FETCH HISTORY
             const history = await this.get<any>(tenantId, `
                 SELECT * FROM product_price_versions 
                 WHERE tenant_id = ? AND product_supplier_id = ? 
                 ORDER BY valid_from DESC
             `, [tenantId, s.id]);

             return {
                 id: s.supplier_id,
                 linkId: s.id, // Important
                 name: def ? def.name : 'Unknown Supplier',
                 source: s.supplier_type,
                 isActive: !!s.is_active,
                 isDefault: false,
                 purchasePrice: s.v_purchase_price || 0,
                 margin: s.v_margin || 0,
                 vat: s.v_vat || 0,
                 salesPrice: s.v_sale_price_ttc || 0,
                 priceVersions: history.map((h:any) => ({
                     id: h.id,
                     purchasePrice: h.purchase_price,
                     salesPrice: h.sale_price_ttc,
                     validFrom: h.valid_from,
                     validTo: h.valid_to,
                     reason: h.change_reason,
                     createdBy: h.created_by,
                     status: h.status
                 }))
             };
        }));

        // Merge
        return {
            ...globalProduct,
            isEnabled: config ? !!config.is_enabled : false,
            minStock: config?.min_stock || 0,
            maxStock: config?.max_stock || 0,
            securityStock: config?.security_stock || 0,
            suppliers: mappedSuppliers
        };
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
        const suppliers = await this.getSuppliers(tenantId);
        
        // Fetch items for each PO (N+1 but minimal for typical list size, or optimize with join)
        for (const po of pos as any[]) {
            po.items = await this.get(tenantId, `SELECT * FROM po_items WHERE tenant_id = ? AND po_id = ?`, [tenantId, po.po_id]);
        }
        return pos.map((p: any) => {
            const supplier = suppliers.find(s => s.id === p.supplier_id);
            return {
                id: p.po_id,
                tenantId: p.tenant_id,
                supplierId: p.supplier_id,
                supplierName: supplier ? supplier.name : 'Inconnu',
                status: p.status,
                date: new Date(p.created_at),
                createdBy: p.created_by || 'Système',
                items: p.items.map((i: any) => ({
                    productId: i.product_id,
                    orderedQty: i.qty_ordered,
                    deliveredQty: i.qty_delivered || 0, // Persisted Qty
                    remainingQty: i.qty_to_be_delivered, // Optional exposure
                    unitPrice: i.unit_price
                }))
            };
        });
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
        return { ...params, id: poId, status: 'ORDERED', createdBy: userId };
    }

    public async getDeliveryNotes(tenantId: string): Promise<any[]> {
        const notes = await this.get(tenantId, `SELECT * FROM delivery_notes WHERE tenant_id = ? ORDER BY received_at DESC`, [tenantId]);
        // Get details
        for (const n of notes as any[]) {
             const items = await this.get(tenantId, `SELECT * FROM delivery_note_items WHERE tenant_id = ? AND delivery_note_id = ?`, [tenantId, n.delivery_note_id]);
             n.items = items.map((i: any) => ({
                 productId: i.product_id,
                 deliveredQty: i.qty_pending, // Used Pending as Delivered in this context for now
                 batchNumber: null, // Blind reception has no batch yet
                 expiryDate: null
             }));
        }
        return notes.map((n: any) => ({
            id: n.delivery_note_id,
            status: n.status || 'PENDING',
            poId: n.po_id, // Return PO ID for filtering
            date: new Date(n.received_at),
            items: n.items,
            createdBy: n.created_by
        }));
    }

    public async createDeliveryNote(params: any): Promise<any> {
        // params: { tenantId, poId, noteId, items: [ { productId, deliveredQty, batchNumber, expiryDate } ], userId }
        const { tenantId, poId, items, userId } = params;
        const noteId = params.noteId || params.id || `BL-${Date.now()}`;
        
        // 1. Process Receipt (Stock + Movements)
        // Need to map simple items to what processReceipt expects (qtyPending instead of deliveredQty)
        const receiptItems = items.map((i: any) => ({
            productId: i.productId,
            // lot: i.batchNumber, // REMOVED for Blind Reception
            // expiry: i.expiryDate, // REMOVED for Blind Reception
            qtyPending: i.deliveredQty, // Map to new Pending Field
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

                 // NEW LOGIC: Update PO Items Quantity + Save PO Link in Receipt
                 // Since we have poId, we can update po_items
                 for (const item of items) {
                     // item.deliveredQty is what is delivered NOW.
                     // We need to INCREMENT qty_delivered in po_items
                     
                     // Get current state to calculate remainder? Or just SQL update
                     // qty_to_be_delivered = qty_ordered - (new_total_delivered)
                     // Implementation:
                     // UPDATE po_items SET qty_delivered = qty_delivered + ?, qty_to_be_delivered = qty_ordered - (qty_delivered + ?)
                     // WHERE po_id = ? AND product_id = ?
                     
                     await this.run(tenantId, `
                        UPDATE po_items 
                        SET qty_delivered = qty_delivered + ?,
                            qty_to_be_delivered = qty_ordered - (qty_delivered + ?)
                        WHERE po_id = ? AND product_id = ? AND tenant_id = ?
                     `, [item.deliveredQty, item.deliveredQty, poId, item.productId, tenantId]);
                 }
             }
        }

        // Pass poId to processDeliveryNote if we want to save it in delivery_notes?
        // processDeliveryNote signature modification vs direct update.
        // Easier: update processDeliveryNote signature to accept optional poId.
        
        await this.processDeliveryNote({
            tenantId,
            items: receiptItems,
            location: 'PHARMACY_MAIN', // Default
            documentId: noteId,
            userId,
            poId // Pass to processDeliveryNote
        });
        
        return { id: noteId, ...params };
    }

    public async processQuarantine(params: {
         tenantId: string,
         noteId: string, // Delivery Note ID
         items: any[],   // Request items with batches/returns
         processedBy: string
    }) {
         const { tenantId, noteId, items, processedBy } = params;

         // 1. Get Delivery Note to find Supplier
         const notes = await this.get(tenantId, `SELECT * FROM delivery_notes WHERE delivery_note_id = ?`, [noteId]) as any[];
         const note = notes && notes.length > 0 ? notes[0] : null;
         
         if (!note) throw new Error(`Delivery Note ${noteId} not found`);

         // TODO: If note has a PO, we might want to check against it, but for now we trust the flow.
         const supplierId = note.supplier_id || 'UNKNOWN';

         // Group Batches by Product to perform ONE WAC Update per Product
         const batchesByProduct: Record<string, { qty: number, batches: any[] }> = {};
         for (const item of items) {
             if (!item.batches || item.batches.length === 0) continue;
             if (!batchesByProduct[item.productId]) {
                 batchesByProduct[item.productId] = { qty: 0, batches: [] };
             }
             for (const batch of item.batches) {
                 const q = Number(batch.quantity);
                 if (q > 0) {
                     batchesByProduct[item.productId].qty += q;
                     batchesByProduct[item.productId].batches.push(batch);
                 }
             }
         }

         const resultItems: any[] = [];

         for (const item of items) {
             const productData = batchesByProduct[item.productId];
             if (!productData) {
                 resultItems.push(item);
                 continue;
             }

             // --- WAC CALCULATION (Once per product) ---
             // Only if we haven't processed this product in this loop yet 
             // (Simple check: iterate Object.keys or use a Set map. Here we iterate Items which might repeat?
             // Usually items are unique by product in payload. We assume uniqueness or handle idempotency.)
             
             // 1. Determine Unit Cost (Priority: PO Item ONLY)
             let unitCost = 0;
             if (note.po_id) {
                 const poItem = await this.get<any>(tenantId, `SELECT unit_price FROM po_items WHERE po_id = ? AND product_id = ?`, [note.po_id, item.productId]).then(r => r[0]);
                 if (poItem) unitCost = Number(poItem.unit_price) || 0;
             }
             
             // STRICT: If no PO or no Price, unitCost matches 0.
             if (unitCost === 0) {
                 console.warn(`[WAC] Warning: Zero cost for Injection. Product=${item.productId}, PO=${note.po_id}`);
             }

             // 2. Fetch Current Stock (Sum of all locations)
             const stockRow = await this.get<any>(tenantId, `SELECT SUM(qty_units) as total FROM current_stock WHERE tenant_id = ? AND product_id = ?`, [tenantId, item.productId]).then(r => r[0]);
             const currentStock = Number(stockRow?.total) || 0;

             // 3. Fetch Old WAC
             const wacRow = await this.get<any>(tenantId, `SELECT wac FROM product_wac WHERE tenant_id = ? AND product_id = ?`, [tenantId, item.productId]).then(r => r[0]);
             const oldWac = wacRow ? Number(wacRow.wac) : 0;
             const hasOldWac = !!wacRow;

             // 4. Calculate New WAC
             const injectedQty = productData.qty;
             let newWac = unitCost;
             
             if (hasOldWac && (currentStock + injectedQty) > 0) {
                 const totalValue = (currentStock * oldWac) + (injectedQty * unitCost);
                 const totalQty = currentStock + injectedQty;
                 newWac = totalValue / totalQty;
             } else if (!hasOldWac) {
                 newWac = unitCost;
             }
             
             // 5. Update WAC Table
             await this.run(tenantId, `
                 INSERT INTO product_wac (tenant_id, product_id, wac, last_updated)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(tenant_id, product_id) DO UPDATE SET wac = excluded.wac, last_updated = CURRENT_TIMESTAMP
             `, [tenantId, item.productId, newWac]);

             // --- PROCESS BATCHES ---
             for (const batch of productData.batches) {
                 const qty = Number(batch.quantity);

                 // Inventory Movement
                 const movementId = uuidv4();
                 await this.run(tenantId, `
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units,
                        from_location, to_location, document_type, document_id, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 `, [movementId, tenantId, item.productId, batch.batchNumber, batch.expiryDate, qty,
                     'QUARANTINE', batch.locationId, 'DELIVERY_INJECTION', noteId, processedBy]);

                 // Update Stock
                 await this.upsertStock(tenantId, item.productId, batch.batchNumber, new Date(batch.expiryDate), batch.locationId, qty);
                 
                 // Traceability Layer (With Cost)
                 await this.run(tenantId, `
                    INSERT INTO delivery_note_layers (
                        delivery_note_id, tenant_id, product_id, lot, expiry,
                        qty_received, qty_remaining, purchase_unit_cost
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 `, [noteId, tenantId, item.productId, batch.batchNumber, batch.expiryDate, 
                     qty, qty, unitCost]);
             }
             
             // Removed from batch loop to avoid double processing if items array has dupes (unlikely but safe) (Wait, I loop items, so I should be careful)
             // Optimization: logic assumes items are unique by product ID.
             resultItems.push(item);
         }
         
         // 5. Update Status
         await this.run(tenantId, `UPDATE delivery_notes SET status = 'PROCESSED' WHERE delivery_note_id = ?`, [noteId]);
         
         return { success: true, id: noteId, items: resultItems, processedBy, processedDate: new Date() };
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
        const { globalSupplierService } = require('./globalSupplierService');

        // 1. Fetch Tenant Configs (SQL)
        const dbConfigs = await this.get<any>(tenantId, `SELECT * FROM product_configs`);

        const dbSuppliers = await this.get<any>(tenantId, `
            SELECT ps.id, ps.tenant_id, ps.product_id, ps.supplier_id, ps.supplier_type, ps.is_active,
                   ppv.id as ppv_id,
                   ppv.purchase_price as v_purchase_price, 
                   ppv.margin as v_margin, 
                   ppv.vat as v_vat, 
                   ppv.vat as v_vat, 
                   ppv.sale_price_ttc as v_sale_price_ttc, 
                   ppv.sale_price_ht as v_sale_price_ht,
                   ppv.unit_sale_price as v_unit_sale_price
            FROM product_suppliers ps
            LEFT JOIN product_price_versions ppv ON ps.id = ppv.product_supplier_id AND ppv.valid_to IS NULL
            WHERE ps.tenant_id = ?
        `, [tenantId]);


        console.log(`[PharmacyService] getCatalogPaginated: Fetched ${dbSuppliers.length} active supplier links for tenant ${tenantId}.`);
        if (dbSuppliers.length > 0) {
             // console.log(`[PharmacyService] Sample Supplier Link:`, JSON.stringify(dbSuppliers[0], null, 2));
        }

        // 2. Filter IDs?
        let idsFilter: string[] | undefined;
        if (status === 'ACTIVE') {
            // Robust check for SQLite boolean (1, true, "1")
            idsFilter = dbConfigs
                .filter((c: any) => c.is_enabled === 1 || c.is_enabled === true || c.is_enabled === '1')
                .map((c: any) => c.product_id);
            
            console.log(`[PharmacyService] ACTIVE Filter: Found ${idsFilter.length} enabled products out of ${dbConfigs.length} configs.`);

            // FIX: If status is ACTIVE and no enabled products, return empty immediately
            if (idsFilter.length === 0) {
                 console.log('[PharmacyService] No active products found. Returning empty.');
                 return { data: [], total: 0, page, totalPages: 0 };
            }
        }

        // 3. Fetch Global Products
        const { data: globalProducts, total, totalPages } = await globalProductService.getProductsPaginated(page, limit, query, idsFilter);

        // 4. Reference Data (Suppliers)
        const tenantLocalSuppliers = await this.get<any>(tenantId, `SELECT * FROM suppliers WHERE tenant_id = ?`, [tenantId]); // Only local definitions
        const globalSupplierDefs = await globalSupplierService.getAll();
        const allSuppliers = [...globalSupplierDefs, ...tenantLocalSuppliers];

        // 5. Merge
        const mergedProducts = globalProducts.map((gp: any) => {
            const config = dbConfigs.find((c: any) => c.product_id === gp.id);
            const mySuppliers = dbSuppliers.filter((s: any) => s.product_id === gp.id);

            const suppliersMapped = mySuppliers.map((s: any) => {
                // Resolve Name
                let def;
                if (s.supplier_type === 'LOCAL') {
                    def = tenantLocalSuppliers.find((l: any) => l.supplier_id === s.supplier_id);
                } else {
                    def = allSuppliers.find((g: any) => g.id === s.supplier_id);
                }

                if (!def) {
                    console.warn(`[PharmacyService] Unknown Supplier ID: '${s.supplier_id}' (Type: ${s.supplier_type}) for Link ${s.id}`);
                    // Debug: Log active global IDs to see mismatch
                    if (s.supplier_type === 'GLOBAL' && allSuppliers.length > 0) {
                         const sampleIds = allSuppliers.slice(0, 5).map((g: any) => g.id).join(', ');
                         console.warn(`[PharmacyService] Available Global IDs (Sample): ${sampleIds}`);
                    }
                }

                return {
                    id: s.supplier_id,
                    linkId: s.id, // Store linkId to help debugging if needed
                    name: def?.name || 'Unknown Supplier',
                    source: s.supplier_type,
                    purchasePrice: s.v_purchase_price ?? s.purchase_price ?? 0,
                    margin: s.v_margin ?? s.margin ?? 0,
                    vat: s.v_vat ?? s.vat ?? 0,
                    salePriceHT: s.v_sale_price_ht ?? 0,
                    salePriceTTC: s.v_sale_price_ttc ?? 0,
                    unitSalePrice: s.v_unit_sale_price ?? 0,
                    isActive: s.is_active === 1,
                    isDefault: false, // Retired concept
                };
            }).sort((a: any, b: any) => a.name.localeCompare(b.name));
            
            return {
                ...gp,
                // Client specific override or fallback
                isEnabled: config ? (config.is_enabled === 1 || config.is_enabled === true) : false, // Default false
                minStock: config?.min_stock,
                maxStock: config?.max_stock,
                securityStock: config?.security_stock,
                
                suppliers: suppliersMapped,

                // Computed/legacy fields for UI grid
                profitMargin: suppliersMapped[0]?.margin || 0, 
                vatRate: suppliersMapped[0]?.vat || 0,
                tenantId
            };
        });

        // 6. Enrichment: Fetch Full Price History for all visibly loaded suppliers
        const productSupplierLinkIds = dbSuppliers.map((s: any) => s.id);
        
        if (productSupplierLinkIds.length > 0) {
            // console.log(`[PharmacyService] Fetching history for ${productSupplierLinkIds.length} links:`, productSupplierLinkIds);
            
            const placeholders = productSupplierLinkIds.map(() => '?').join(',');
            const allHistory = await this.get<any>(tenantId, `
                SELECT *, change_reason FROM product_price_versions 
                WHERE product_supplier_id IN (${placeholders})
                ORDER BY valid_from DESC
            `, productSupplierLinkIds);

            // console.log(`[PharmacyService] Found ${allHistory.length} history entries.`);

            // Attach history to the merged structure
            mergedProducts.forEach((prod: any) => {
                prod.suppliers.forEach((supp: any) => {
                    const history = allHistory.filter((v: any) => v.product_supplier_id === supp.linkId);
                    
                    supp.priceVersions = history.map((h: any) => ({
                        id: h.id,
                        purchasePrice: h.purchase_price,
                        margin: h.margin,
                        vat: h.vat, // Ensure mapped
                        salePriceTTC: h.sale_price_ttc,
                        validFrom: new Date(h.valid_from),
                        validTo: h.valid_to ? new Date(h.valid_to) : undefined,
                        createdBy: h.created_by,
                        changeReason: h.change_reason || '-'
                    }));
                });
            });
        }


        // FIX: The query parameter in getProductsPaginated might not filter correctly if we are relying on partial matches?
        // Actually globalProductService handles query.
        

        


        return { data: mergedProducts, total, page, totalPages };
    }


    public async getCatalog(tenantId: string): Promise<any[]> {
        // Use Paginated method with high limit to get all enriched data (Configs + Suppliers)
        // This ensures frontend receives 'suppliers' array needed for Stock Entry filtering.
        const result = await this.getCatalogPaginated(tenantId, 1, 10000, '', 'ALL');
        return result.data;
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
        await this.run(tenantId, `DELETE FROM delivery_note_items WHERE tenant_id = ?`, [tenantId]); // Was receipt_layers
        await this.run(tenantId, `DELETE FROM delivery_note_layers WHERE tenant_id = ?`, [tenantId]); // Was receipt_layers (wait, check mapping)
        await this.run(tenantId, `DELETE FROM delivery_notes WHERE tenant_id = ?`, [tenantId]); // Was purchase_receipts
        await this.run(tenantId, `DELETE FROM supplier_return_lines WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM supplier_returns WHERE tenant_id = ?`, [tenantId]);
        await this.run(tenantId, `DELETE FROM medication_dispense_events WHERE tenant_id = ?`, [tenantId]);
        // Also wipe locations/suppliers if requested? "Clean state". Maybe not.
    }
}

export const pharmacyService = PharmacyService.getInstance();
