import { v4 as uuidv4 } from 'uuid';
import { stockTransferService } from './stockTransferService';
import { tenantQuery, tenantTransaction, getTenantPool } from '../db/tenantPg';

export interface StockPosition {
    tenantId: string;
    productId: string;
    lot: string;
    expiry: any; // Date or string (YYYY-MM-DD)
    location: string;
    qtyUnits: number;
    reservedUnits?: number;           // Active reservations (basket/transfer)
    pendingReturnUnits?: number;      // Declared but not yet received returns
    availableUnits?: number;          // Effective available: qtyUnits - reservedUnits - pendingReturnUnits
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
        // PostgreSQL: Use $n placeholders with dynamic index
        // FORCE STRING DATE to prevent timezone shifts (e.g. 2026-01-30 -> 2026-01-29T23:00:00Z)
        // Include reserved_units and pending_return_units for effective available stock
        let query = `SELECT tenant_id, product_id, lot, to_char(expiry, 'YYYY-MM-DD') as expiry, location_id as location, 
                     qty_units, COALESCE(reserved_units, 0) as reserved_units, 
                     COALESCE(pending_return_units, 0) as pending_return_units,
                     (qty_units - COALESCE(reserved_units, 0) - COALESCE(pending_return_units, 0)) as available_units
                     FROM current_stock WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        let paramIndex = 2;

        if (location) {
            query += ` AND location_id = $${paramIndex++}`;
            params.push(location);
        }
        if (productId) {
            query += ` AND product_id = $${paramIndex++}`;
            params.push(productId);
        }

        // Exclude 0 or negative stock from view (business logic unchanged)
        query += ` AND qty_units > 0`;

        return this.get(tenantId, query, params).then(rows => rows.map((row: any) => ({
            tenantId: row.tenant_id,
            productId: row.product_id,
            lot: row.lot,
            expiry: row.expiry, // Now a string "YYYY-MM-DD"
            location: row.location,
            qtyUnits: row.qty_units,
            reservedUnits: row.reserved_units || 0,
            pendingReturnUnits: row.pending_return_units || 0,
            availableUnits: row.available_units || row.qty_units
        })));
    }

    /**
     * SCOPE-FILTERED STOCK QUERY
     * Returns stock filtered by location scope (PHARMACY or SERVICE).
     * For SERVICE scope, also filters by service_id.
     * 
     * IMPORTANT: current_stock.location is TEXT, locations.location_id is UUID
     * We must cast to avoid "operator does not exist: text = uuid" errors
     */
    public async getStockScoped(tenantId: string, scope: 'PHARMACY' | 'SERVICE', serviceId?: string): Promise<StockPosition[]> {
        console.log(`[getStockScoped] START - tenant=${tenantId} scope=${scope} serviceId=${serviceId}`);
        
        // Build query with explicit UUID casting for type safety
        // Include reserved_units and pending_return_units for effective available stock
        let query = `
            SELECT cs.tenant_id, cs.product_id, cs.lot, to_char(cs.expiry, 'YYYY-MM-DD') as expiry, 
                   cs.location_id as location, cs.qty_units, 
                   COALESCE(cs.reserved_units, 0) as reserved_units,
                   COALESCE(cs.pending_return_units, 0) as pending_return_units,
                   (cs.qty_units - COALESCE(cs.reserved_units, 0) - COALESCE(cs.pending_return_units, 0)) as available_units,
                   l.scope, l.service_id
            FROM current_stock cs
            JOIN locations l ON cs.location_id = l.location_id AND cs.tenant_id = l.tenant_id
            WHERE cs.tenant_id = $1 AND l.scope = $2 AND cs.qty_units > 0
        `;
        const params: any[] = [tenantId, scope];
        let paramIndex = 3;

        // For SERVICE scope, service_id filtering is REQUIRED
        if (scope === 'SERVICE') {
            if (!serviceId) {
                console.error(`[getStockScoped] ERROR: SERVICE scope requires serviceId`);
                throw new Error('SERVICE scope requires serviceId parameter');
            }
            // Cast serviceId string to UUID for comparison with l.service_id (UUID type)
            query += ` AND l.service_id = $${paramIndex++}::uuid`;
            params.push(serviceId);
        }

        console.log(`[getStockScoped] QUERY:`, query);
        console.log(`[getStockScoped] PARAMS:`, params);

        const rows = await this.get(tenantId, query, params);
        console.log(`[getStockScoped] RESULT: ${rows.length} rows returned`);
        
        return rows.map((row: any) => ({
            tenantId: row.tenant_id,
            productId: row.product_id,
            lot: row.lot,
            expiry: row.expiry,
            location: row.location,
            qtyUnits: row.qty_units,
            reservedUnits: row.reserved_units || 0,
            pendingReturnUnits: row.pending_return_units || 0,
            availableUnits: row.available_units || row.qty_units,
            scope: row.scope,
            serviceId: row.service_id
        }));
    }

    public async getMovements(tenantId: string, limit: number = 100): Promise<Movement[]> {
        const query = `
            SELECT 
                movement_id, tenant_id, product_id, lot, to_char(expiry, 'YYYY-MM-DD') as expiry, 
                qty_units, from_location_id as from_location, to_location_id as to_location, document_type, document_id, created_by, created_at
            FROM inventory_movements  
            WHERE tenant_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2`;
        
        return this.get(tenantId, query, [tenantId, limit]).then(rows => rows.map((row: any) => ({
            movementId: row.movement_id,
            tenantId: row.tenant_id,
            productId: row.product_id,
            lot: row.lot,
            expiry: row.expiry, // String
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
        documentId: string, // BL ID (Reference)
        deliveryUuid?: string, // UUID for PK
        userId: string,
        poId?: string // Optional link to PO
    }): Promise<void> {
        const { tenantId, items, location, documentId, userId, poId, deliveryUuid } = params;

        // Transaction simulation (Series of ops)
        const deliveryNoteId = deliveryUuid || uuidv4();
        
        await this.run(tenantId, `
            INSERT INTO delivery_notes (delivery_note_id, tenant_id, supplier_id, po_id, received_at, created_by, reference)
            VALUES ($1, $2, $3, $4, NOW(), $5, $6)
            ON CONFLICT (delivery_note_id) DO NOTHING
        `, [deliveryNoteId, tenantId, items[0]?.supplierId || 'UNKNOWN', poId || null, userId, documentId]);

        for (const item of items) {
             const qty = item.qtyPending || item.qtyUnits || 0;
             const { productId } = item;
             
             // NEW FLOW: Insert into delivery_note_items (Quarantine/Pending Verification)
             // No Lot/Expiry required at this stage.
             await this.run(tenantId, `
                INSERT INTO delivery_note_items (id, tenant_id, delivery_note_id, product_id, qty_pending, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             `, [uuidv4(), tenantId, deliveryNoteId, productId, qty]);
        }
    }

    /**
     * TIER 4: RESERVATION-AWARE DISPENSE
     * 
     * Same concurrency contract as transfer():
     * - Single atomic transaction
     * - Deterministic FOR UPDATE locking of current_stock rows (lot+expiry)
     * - Reservation-aware availability (on_hand − active_reserved)
     * - Guarded decrements per row (WHERE qty_units >= take)
     * - Write inventory_movements + dispense audit lines
     * 
     * Uses FEFO (First Expiry First Out) lot selection.
     */
    public async dispense(params: {
        tenantId: string,
        prescriptionId: string,
        admissionId: string,
        items: Array<{ productId: string, qtyRequested: number }>,
        sourceLocation: string,
        userId: string
    }): Promise<void> {
        const { tenantId, prescriptionId, admissionId, items, sourceLocation, userId } = params;

        return tenantTransaction(tenantId, async (client) => {
            for (const item of items) {
                let remaining = item.qtyRequested;

                // STEP 1: Lock all stock rows for this product (prevents concurrent modification)
                await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND location_id = $2 AND product_id = $3
                    FOR UPDATE
                `, [tenantId, sourceLocation, item.productId]);

                // STEP 2: Calculate available = physical - active_reservations (FEFO ordering)
                const availablePositions = await client.query(`
                    SELECT 
                        cs.product_id, cs.lot, cs.expiry, cs.location_id as location, cs.qty_units,
                        COALESCE(reserved.total, 0) as reserved_qty,
                        (cs.qty_units - COALESCE(reserved.total, 0)) as available_qty
                    FROM current_stock cs
                    LEFT JOIN (
                        SELECT l.product_id, l.lot, l.expiry, l.source_location_id as location_id, SUM(l.qty_units) as total
                        FROM stock_reservation_lines l
                        JOIN stock_reservations r ON l.reservation_id = r.reservation_id
                        WHERE r.tenant_id = $1 
                          AND r.status = 'ACTIVE' 
                          AND r.expires_at > NOW()
                        GROUP BY l.product_id, l.lot, l.expiry, l.source_location_id
                    ) reserved ON 
                        reserved.product_id = cs.product_id AND
                        reserved.lot = cs.lot AND
                        reserved.expiry = cs.expiry AND
                        reserved.location_id = cs.location_id
                    WHERE cs.tenant_id = $1 
                      AND cs.location_id = $2 
                      AND cs.product_id = $3
                      AND cs.qty_units > 0
                    ORDER BY cs.expiry ASC
                `, [tenantId, sourceLocation, item.productId]);

                for (const position of availablePositions.rows) {
                    if (remaining <= 0) break;
                    
                    // Only use available qty (physical - reserved)
                    const availableQty = parseInt(position.available_qty) || 0;
                    if (availableQty <= 0) continue;
                    
                    const take = Math.min(availableQty, remaining);

                    // STEP 3: GUARDED ATOMIC DECREMENT source stock (full row identity)
                    const decrementResult = await client.query(`
                        UPDATE current_stock
                        SET qty_units = qty_units - $1
                        WHERE tenant_id = $2
                          AND location_id = $3
                          AND product_id = $4
                          AND lot = $5
                          AND expiry = $6
                          AND qty_units >= $1
                        RETURNING qty_units
                    `, [take, tenantId, sourceLocation, position.product_id, position.lot, position.expiry]);

                    if (decrementResult.rowCount === 0) {
                        throw new Error(`INSUFFICIENT_STOCK: Cannot dispense ${take} from lot ${position.lot}`);
                    }

                    // STEP 4 + 5: Generate dispense_id first, then link both records
                    // Document lineage: inventory_movements.document_id = medication_dispense_events.id
                    const dispenseId = uuidv4();
                    
                    // Lookup tenant-specific DISPENSED location (NEVER use hardcoded global UUID)
                    const dispensedLocResult = await client.query(`
                        SELECT location_id FROM locations 
                        WHERE tenant_id = $1 AND name = 'DISPENSED' AND scope = 'SYSTEM'
                    `, [tenantId]);
                    
                    if (dispensedLocResult.rows.length === 0) {
                        throw new Error(`CONFIGURATION_ERROR: DISPENSED system location not found for tenant ${tenantId}`);
                    }
                    const DISPENSED_LOCATION_ID = dispensedLocResult.rows[0].location_id;
                    
                    // Insert inventory_movement with proper document lineage
                    const movementId = uuidv4();
                    await client.query(`
                        INSERT INTO inventory_movements (
                            movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                            from_location_id, to_location_id, document_type, document_id, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [movementId, tenantId, position.product_id, position.lot, position.expiry, -take, 
                        sourceLocation, DISPENSED_LOCATION_ID, 'DISPENSE', dispenseId, userId]);

                    // Clinical Event Sink (medication_dispense_events)
                    // prescription_id / admission_id remain here for clinical context
                    await client.query(`
                        INSERT INTO medication_dispense_events (
                            id, tenant_id, prescription_id, admission_id, product_id, lot, expiry, 
                            qty_dispensed, dispensed_by, dispensed_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    `, [dispenseId, tenantId, prescriptionId || null, admissionId || null, position.product_id, position.lot, position.expiry, take, userId]);

                    remaining -= take;
                }

                if (remaining > 0) {
                    throw new Error(`INSUFFICIENT_AVAILABLE_STOCK: Cannot dispense ${item.qtyRequested} units of ${item.productId}, only ${item.qtyRequested - remaining} available (respects active reservations)`);
                }
            }
        });
    }

    // --- 4. REPLENISHMENT / TRANSFER ---

    /**
     * TIER 3: RESERVATION-AWARE TRANSFER
     * 
     * Any direct stock deduction must be reservation-aware:
     * Available = qty_units - SUM(active reservations) >= requested
     * 
     * Uses FEFO (First Expiry First Out) lot selection.
     * Creates inventory_movements for audit trail.
     */
    public async transfer(params: {
        tenantId: string,
        fromLocation: string,
        toLocation: string,
        items: Array<{ productId: string, qty: number }>, // Auto-FEFO
        userId: string,
        documentId?: string
    }): Promise<void> {
        const { tenantId, fromLocation, toLocation, items, userId, documentId } = params;

        return tenantTransaction(tenantId, async (client) => {
            for (const item of items) {
                let remaining = item.qty;

                // STEP 1: First, lock all stock rows for this product (prevents concurrent modification)
                await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND location_id = $2 AND product_id = $3
                    FOR UPDATE
                `, [tenantId, fromLocation, item.productId]);

                // STEP 2: Now calculate available = physical - active_reservations (no FOR UPDATE with aggregates)
                const availablePositions = await client.query(`
                    SELECT 
                        cs.product_id, cs.lot, cs.expiry, cs.location_id as location, cs.qty_units,
                        COALESCE(reserved.total, 0) as reserved_qty,
                        (cs.qty_units - COALESCE(reserved.total, 0)) as available_qty
                    FROM current_stock cs
                    LEFT JOIN (
                        SELECT l.product_id, l.lot, l.source_location_id as location_id, SUM(l.qty_units) as total
                        FROM stock_reservation_lines l
                        JOIN stock_reservations r ON l.reservation_id = r.reservation_id
                        WHERE r.tenant_id = $1 
                          AND r.status = 'ACTIVE' 
                          AND r.expires_at > NOW()
                        GROUP BY l.product_id, l.lot, l.source_location_id
                    ) reserved ON 
                        reserved.product_id = cs.product_id AND
                        reserved.lot = cs.lot AND
                        reserved.location_id = cs.location_id
                    WHERE cs.tenant_id = $1 
                      AND cs.location_id = $2 
                      AND cs.product_id = $3
                      AND cs.qty_units > 0
                    ORDER BY cs.expiry ASC
                `, [tenantId, fromLocation, item.productId]);

                for (const position of availablePositions.rows) {
                    if (remaining <= 0) break;
                    
                    // Only use available qty (physical - reserved)
                    const availableQty = parseInt(position.available_qty) || 0;
                    if (availableQty <= 0) continue;
                    
                    const take = Math.min(availableQty, remaining);

                    // GUARDED ATOMIC DECREMENT source stock
                    const decrementResult = await client.query(`
                        UPDATE current_stock
                        SET qty_units = qty_units - $1
                        WHERE tenant_id = $2
                          AND location_id = $3
                          AND product_id = $4
                          AND lot = $5
                          AND qty_units >= $1
                        RETURNING qty_units
                    `, [take, tenantId, fromLocation, position.product_id, position.lot]);

                    if (decrementResult.rowCount === 0) {
                        throw new Error(`INSUFFICIENT_STOCK: Cannot deduct ${take} from lot ${position.lot}`);
                    }

                    // INCREMENT destination stock (atomic upsert)
                    await client.query(`
                        INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT(tenant_id, product_id, lot, location_id) 
                        DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                    `, [tenantId, position.product_id, position.lot, position.expiry, toLocation, take]);

                    // Create inventory_movement (no document_type per user requirement)
                    const movementId = uuidv4();
                    await client.query(`
                        INSERT INTO inventory_movements (
                            movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                            from_location_id, to_location_id, document_id, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [movementId, tenantId, position.product_id, position.lot, position.expiry, take, 
                        fromLocation, toLocation, documentId || 'MANUAL_TRANSFER', userId]);

                    remaining -= take;
                }

                if (remaining > 0) {
                    throw new Error(`INSUFFICIENT_AVAILABLE_STOCK: Cannot transfer ${item.qty} units of ${item.productId}, only ${item.qty - remaining} available (respects active reservations)`);
                }
            }
        });
    }


    // --- HELPERS ---

    private async run(tenantId: string, sql: string, params: any[] = []): Promise<void> {
        await tenantQuery(tenantId, sql, params);
    }

    private async get<T>(tenantId: string, sql: string, params: any[] = []): Promise<T[]> {
        return tenantQuery(tenantId, sql, params);
    }

    /**
     * ATOMIC STOCK UPDATE - Three-path implementation
     * 
     * Path 1: INSERT - New stock position (positive delta only)
     * Path 2: INCREMENT - Add to existing stock (positive delta)
     * Path 3: GUARDED DECREMENT - Deduct with qty_units >= delta check
     * 
     * INVARIANT: qty_units >= 0 is enforced by database CHECK constraint
     * NO temporary negative stock is allowed
     * All stock math happens in SQL, not in Node.js
     */
    private async upsertStock(tenantId: string, productId: string, lot: string, expiry: Date | string, location: string, deltaQty: number) {
        const expStr = typeof expiry === 'string' ? expiry.split('T')[0] : expiry.toISOString().split('T')[0];

        if (deltaQty > 0) {
            // PATH 1 & 2: INSERT or INCREMENT (positive delta)
            // Uses ON CONFLICT for atomic upsert - safe because adding stock never violates constraint
            const sql = `
                INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT(tenant_id, product_id, lot, location_id) 
                DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
            `;
            await this.run(tenantId, sql, [tenantId, productId, lot, expStr, location, deltaQty]);
        } else if (deltaQty < 0) {
            // PATH 3: GUARDED DECREMENT (negative delta)
            // Uses WHERE guard to prevent constraint violation
            // If stock is insufficient, rowCount = 0 and we throw error
            const absQty = Math.abs(deltaQty);
            const sql = `
                UPDATE current_stock
                SET qty_units = qty_units - $1
                WHERE tenant_id = $2
                  AND product_id = $3
                  AND lot = $4
                  AND location_id = $5
                  AND qty_units >= $1
                RETURNING qty_units
            `;
            
            const pool = getTenantPool(tenantId);
            const result = await pool.query(sql, [absQty, tenantId, productId, lot, location]);
            
            if (result.rowCount === 0) {
                throw new Error(`INSUFFICIENT_STOCK: Cannot deduct ${absQty} units from product ${productId}, lot ${lot}, location ${location}`);
            }
        }
        // deltaQty === 0: no-op
    }

    // --- 5. LOCATIONS (SQL) ---

    // Return type Any to avoid importing legacy models if possible, or define interface
    public async getLocations(tenantId: string, serviceId?: string, scope?: 'PHARMACY' | 'SERVICE'): Promise<any[]> {
        console.log(`[getLocations] START tenant=${tenantId} service=${serviceId} scope=${scope}`);
        
        // 1. Fetch from 'locations' table (Pharmacy specific, or explicitly defined service stocks)
        let queryLoc = `SELECT location_id as id, name, type, scope, service_id, location_class, valuation_policy, status FROM locations WHERE tenant_id = $1`;
        const paramsLoc: any[] = [tenantId];
        let paramIndex = 2;
        
        if (serviceId) {
            queryLoc += ` AND service_id = $${paramIndex++}`;
            paramsLoc.push(serviceId);
        }
        if (scope) {
            queryLoc += ` AND scope = $${paramIndex++}`;
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
                locationClass: r.location_class || 'COMMERCIAL',
                valuationPolicy: r.valuation_policy || 'VALUABLE',
                status: r.status || 'ACTIVE',
                isActive: (r.status === 'ACTIVE' || !r.status),
                tenantId: tenantId
            }));
        }).catch(err => {
            console.error(`[getLocations] LOCATIONS QUERY ERROR:`, err);
            throw err;
        });

        // 2. Fetch from 'service_units' table (Settings module) IF scope allows SERVICE
        if (!scope || scope === 'SERVICE') {
            console.log(`[getLocations] Querying service_units...`);
            let queryUnits = `SELECT id, name, type, service_id FROM service_units`;
            const paramsUnits: any[] = [];
            
            if (serviceId) {
                queryUnits += ` WHERE service_id = $1`;
                paramsUnits.push(serviceId);
            }

            try {
                const rows = await this.get(tenantId, queryUnits, paramsUnits);

                console.log(`[getLocations] SERVICE_UNITS found: ${rows.length}`);

                const serviceUnits = rows.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    type: 'WARD',
                    status: 'ACTIVE',
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
                 return locations;
            }
        }

        return locations;
    }

    /**
     * CONTEXT-BASED LOCATION ACCESS
     * 
     * Contexts:
     * - CONFIG_LOCATIONS: Pharmacy Emplacements config page (PHARMACY + PHYSICAL only)
     * - STOCK_PHARMACY: Stock Pharma page (PHARMACY + PHYSICAL)
     * - STOCK_SERVICE: Stock Service page (SERVICE + PHYSICAL + specific service)
     * - SYSTEM_LOCATIONS: All locations including VIRTUAL (for engine/transfers/returns)
     */
    public async getLocationsByContext(
        context: 'CONFIG_LOCATIONS' | 'STOCK_PHARMACY' | 'STOCK_SERVICE' | 'SYSTEM_LOCATIONS',
        tenantId: string,
        serviceId?: string
    ): Promise<any[]> {
        console.log(`[getLocationsByContext] context=${context} tenant=${tenantId} service=${serviceId}`);

        let query = `SELECT location_id as id, name, type, scope, service_id, location_class, valuation_policy, status FROM locations WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        let paramIndex = 2;

        switch (context) {
            case 'CONFIG_LOCATIONS':
                // Pharmacy config: Only PHYSICAL PHARMACY locations (excludes RETURN_QUARANTINE etc.)
                query += ` AND scope = 'PHARMACY' AND type = 'PHYSICAL'`;
                break;

            case 'STOCK_PHARMACY':
                // Stock Pharma page: PHARMACY + PHYSICAL
                query += ` AND scope = 'PHARMACY' AND type = 'PHYSICAL'`;
                break;

            case 'STOCK_SERVICE':
                // Stock Service page: SERVICE + PHYSICAL + specific service
                query += ` AND scope = 'SERVICE' AND type = 'PHYSICAL'`;
                if (serviceId) {
                    query += ` AND service_id = $${paramIndex++}`;
                    params.push(serviceId);
                }
                break;

            case 'SYSTEM_LOCATIONS':
                // System workflows: ALL locations (no filtering)
                // Used by stock engine, transfers, returns, quarantine
                break;

            default:
                throw new Error(`Unknown location context: ${context}`);
        }

        query += ` ORDER BY name ASC`;

        const rows = await this.get(tenantId, query, params);
        console.log(`[getLocationsByContext] ${context} returned ${rows.length} locations`);

        return rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            scope: r.scope,
            serviceId: r.service_id,
            locationClass: r.location_class || 'COMMERCIAL',
            valuationPolicy: r.valuation_policy || 'VALUABLE',
            status: r.status || 'ACTIVE',
            isActive: (r.status === 'ACTIVE' || !r.status),
            tenantId: tenantId
        }));
    }

    public async addLocation(params: { tenantId: string, name: string, type: string, scope: string, serviceId?: string, id?: string, status?: string, isActive?: boolean, locationClass?: string, valuationPolicy?: string }): Promise<any> {
        const id = params.id || uuidv4();
        const status = params.status || (params.isActive !== undefined ? (params.isActive ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE');
        const locationClass = params.locationClass || 'COMMERCIAL';
        // Auto-determine valuation: CHARITY locations are NON_VALUABLE, else VALUABLE
        const valuationPolicy = params.valuationPolicy || (locationClass === 'CHARITY' ? 'NON_VALUABLE' : 'VALUABLE');
        
        await this.run(params.tenantId, `
            INSERT INTO locations (tenant_id, location_id, name, type, scope, service_id, location_class, valuation_policy, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [params.tenantId, id, params.name, params.type, params.scope, params.serviceId || null, locationClass, valuationPolicy, status]);
        return { ...params, id, status, locationClass, valuationPolicy, isActive: status === 'ACTIVE' };
    }

    public async updateLocation(params: { tenantId: string, id: string, name?: string, type?: string, status?: string, isActive?: boolean }): Promise<any> {
        // Map isActive to status if provided
        let status = params.status;
        if (params.isActive !== undefined) {
            status = params.isActive ? 'ACTIVE' : 'INACTIVE';
        }

        await this.run(params.tenantId, `
            UPDATE locations SET name = COALESCE($1, name), type = COALESCE($2, type), status = COALESCE($3, status)
            WHERE tenant_id = $4 AND location_id = $5
        `, [params.name, params.type, status, params.tenantId, params.id]);
        return { ...params, status, isActive: status === 'ACTIVE' };
    }

    public async deleteLocation(tenantId: string, locationId: string): Promise<void> {
        // SAFETY CHECK: Prevent deletion if stock exists
        // Handle both UUID and legacy ID formats
        try {
            const stockResult = await this.get<any>(tenantId, `
                SELECT COUNT(*) as count FROM current_stock 
                WHERE location_id = $1 AND qty_units > 0
            `, [locationId]);
            const stockCount = parseInt(stockResult[0]?.count || '0');
            
            if (stockCount > 0) {
                throw new Error(`Impossible de supprimer l'emplacement : Il contient ${stockCount} lots de stock.`);
            }
        } catch (e: any) {
            // If query error (e.g., cast issue), try simpler text comparison
            if (!e.message?.includes('lots de stock')) {
                console.log(`[deleteLocation] Stock check fallback for ${locationId}`);
            } else {
                throw e;
            }
        }

        await this.run(tenantId, `DELETE FROM locations WHERE tenant_id = $1 AND location_id = $2`, [tenantId, locationId]);
    }

    // --- 6. SUPPLIERS (SQL) ---

    public async getSuppliers(tenantId: string): Promise<any[]> {
        const { referenceDataService } = require('./referenceDataService');
        
        // 1. Fetch Local
        const localSuppliers = await this.get(tenantId, `SELECT * FROM suppliers WHERE tenant_id = $1`, [tenantId]).then(rows => rows.map((r: any) => ({
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
        const globalSuppliersRaw = await referenceDataService.getSuppliers(tenantId);
        const globalSuppliers = globalSuppliersRaw.map((g: any) => ({
            id: g.id,
            name: g.name,
            email: g.email,
            phone: g.phone,
            address: g.address,
            tenantId: 'GLOBAL',
            source: 'GLOBAL',
            isActive: g.is_active === true || g.is_active === 1 // Handle snake_case from DB
        }));

        // 3. Merge
        return [...globalSuppliers, ...localSuppliers];
    }

    public async addSupplier(params: { tenantId: string, name: string, email?: string, phone?: string, address?: string, id?: string }): Promise<any> {
        const id = params.id || uuidv4();
        await this.run(params.tenantId, `
            INSERT INTO suppliers (tenant_id, supplier_id, name, email, phone, address)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [params.tenantId, id, params.name, params.email, params.phone, params.address]);
        return { ...params, id };
    }

    public async updateSupplier(params: { tenantId: string, id: string, name?: string, email?: string, phone?: string, address?: string }): Promise<any> {
        await this.run(params.tenantId, `
            UPDATE suppliers SET name = $1, email = $2, phone = $3, address = $4
            WHERE tenant_id = $5 AND supplier_id = $6
        `, [params.name, params.email, params.phone, params.address, params.tenantId, params.id]);
        return params;
    }

    public async deleteSupplier(tenantId: string, supplierId: string): Promise<void> {
        await this.run(tenantId, `DELETE FROM suppliers WHERE tenant_id = $1 AND supplier_id = $2`, [tenantId, supplierId]);
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
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
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
                const existingLink = await this.get(tenantId, `SELECT id FROM product_suppliers WHERE tenant_id = $1 AND product_id = $2 AND supplier_id = $3`, [tenantId, productId, supplierId]).then(r => r[0] as any);
                let linkId = existingLink?.id;

                if (!linkId) {
                    linkId = uuidv4();
                    await this.run(tenantId, `INSERT INTO product_suppliers (id, tenant_id, product_id, supplier_id, supplier_type, is_active) VALUES ($1, $2, $3, $4, $5, $6)`, [linkId, ...supplierLinkParams]);
                } else {
                    // Update status if changed
                    await this.run(tenantId, `UPDATE product_suppliers SET is_active = $1 WHERE id = $2`, [isActive, linkId]);
                }

                // 3. Price Versioning
                // Check active version
                const activeVer = await this.get(tenantId, `SELECT * FROM product_price_versions WHERE product_supplier_id = $1 AND valid_to IS NULL`, [linkId]).then(r => r[0] as any);

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
                        SET valid_to = CURRENT_TIMESTAMP, change_reason = $1, status = 'ARCHIVED' 
                        WHERE product_supplier_id = $2 AND (status = 'ACTIVE' OR valid_to IS NULL)
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
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        const { referenceDataService } = require('./referenceDataService');
        // Global Supplier Service removed, use referenceDataService for suppliers too

        // 1. Global Product
        const globalProduct = await referenceDataService.getProductById(tenantId, productId);
        if (!globalProduct) throw new Error("Global Product Not Found");

        // 2. Tenant Config
        const config = await this.get<any>(tenantId, `SELECT * FROM product_configs WHERE tenant_id = $1 AND product_id = $2`, [tenantId, productId])
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
            WHERE ps.tenant_id = $1 AND ps.product_id = $2
        `, [tenantId, productId]);

        // 4. Resolve Supplier Names
        const tenantLocalSuppliers = await this.get<any>(tenantId, `SELECT * FROM suppliers WHERE tenant_id = $1`, [tenantId]);
        const globalSupplierDefs = await referenceDataService.getSuppliers(tenantId); // Use Reference
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
                 WHERE tenant_id = $1 AND product_supplier_id = $2 
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
        // Proxy to reference
        const { referenceDataService } = require('./referenceDataService');
        return referenceDataService.getProductById(tenantId, id);
    }
    
    // Legacy support for controller
    public getStockOutHistory(tenantId: string) { return []; }
    public async getPurchaseOrders(tenantId: string): Promise<any[]> {
        const pos = await this.get(tenantId, `SELECT * FROM purchase_orders WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
        const suppliers = await this.getSuppliers(tenantId);
        
        // Fetch items for each PO (N+1 but minimal for typical list size, or optimize with join)
        for (const po of pos as any[]) {
            po.items = await this.get(tenantId, `SELECT * FROM po_items WHERE tenant_id = $1 AND po_id = $2`, [tenantId, po.po_id]);
        }
        return pos.map((p: any) => {
            const supplier = suppliers.find(s => s.id === p.supplier_id);
            return {
                id: p.reference || p.po_id,
                tenantId: p.tenant_id,
                supplierId: p.supplier_id,
                supplierName: supplier ? supplier.name : 'Inconnu',
                status: p.status,
                reference: p.reference, // Expose explicitly too
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
        const poRef = params.id; // The human readable ID (BC-...)
        const poId = uuidv4(); // The real DB UUID
        
        await this.run(tenantId, `
            INSERT INTO purchase_orders (po_id, tenant_id, supplier_id, status, created_by, reference)
            VALUES ($1, $2, $3, 'ORDERED', $4, $5)
        `, [poId, tenantId, supplierId, userId, poRef]);

        for (const item of items) {
            await this.run(tenantId, `
                INSERT INTO po_items (po_id, tenant_id, product_id, qty_ordered, unit_price)
                VALUES ($1, $2, $3, $4, $5)
            `, [poId, tenantId, item.productId, item.orderedQty, item.unitPrice]);
        }
        return { ...params, id: poRef || poId, status: 'ORDERED', createdBy: userId };
    }

    public async getDeliveryNotes(tenantId: string): Promise<any[]> {
        const notes = await this.get(tenantId, `
            SELECT dn.*, po.reference as po_reference 
            FROM delivery_notes dn
            LEFT JOIN purchase_orders po ON dn.po_id = po.po_id
            WHERE dn.tenant_id = $1 
            ORDER BY dn.received_at DESC
        `, [tenantId]);

        // Get details
        for (const n of notes as any[]) {
             const items = await this.get(tenantId, `SELECT * FROM delivery_note_items WHERE tenant_id = $1 AND delivery_note_id = $2`, [tenantId, n.delivery_note_id]);
             n.items = items.map((i: any) => ({
                 productId: i.product_id,
                 deliveredQty: i.qty_pending, // Used Pending as Delivered in this context for now
                 batchNumber: null, // Blind reception has no batch yet
                 expiryDate: null
             }));
        }
        return notes.map((n: any) => ({
            id: n.reference || n.delivery_note_id,
            status: n.status || 'PENDING',
            poId: n.po_reference || n.po_id, // Return PO Reference if available (to match Frontend PO ID), else UUID
            date: new Date(n.received_at),
            items: n.items,
            createdBy: n.created_by
        }));
    }

    public async createDeliveryNote(params: any): Promise<any> {
        // params: { tenantId, poId, noteId, items: [ { productId, deliveredQty, batchNumber, expiryDate } ], userId }
        let { tenantId, poId, items, userId } = params;
        
        // Resolve PO ID if it's a reference (BC-...)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (poId && !uuidRegex.test(poId)) {
             const res = await this.get<any>(tenantId, `SELECT po_id FROM purchase_orders WHERE reference = $1`, [poId]);
             if (res && res.length > 0) poId = res[0].po_id;
        }

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
             const result = await this.get(tenantId, `SELECT supplier_id FROM purchase_orders WHERE po_id = $1`, [poId]);
             const po: any = result[0];
             if (po) {
                 receiptItems.forEach((i: any) => i.supplierId = po.supplier_id);
                 
                 // Update PO status
                 await this.run(tenantId, `UPDATE purchase_orders SET status = 'RECEIVED', updated_at = CURRENT_TIMESTAMP WHERE po_id = $1`, [poId]);

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
                        SET qty_delivered = qty_delivered + $1,
                            qty_to_be_delivered = qty_ordered - (qty_delivered + $2)
                        WHERE po_id = $3 AND product_id = $4 AND tenant_id = $5
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
            poId, // Pass to processDeliveryNote
            deliveryUuid: uuidv4() // Generate UUID for DB
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
         // Resolve ID just in case
         let dbNoteId = noteId;
         const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
         if (!uuidRegex.test(noteId)) {
             const res = await this.get<any>(tenantId, `SELECT delivery_note_id FROM delivery_notes WHERE reference = $1`, [noteId]);
             if (res && res.length > 0) dbNoteId = res[0].delivery_note_id;
         }

         const notes = await this.get(tenantId, `SELECT * FROM delivery_notes WHERE delivery_note_id = $1`, [dbNoteId]) as any[];
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
                 const poItem = await this.get<any>(tenantId, `SELECT unit_price FROM po_items WHERE po_id = $1 AND product_id = $2`, [note.po_id, item.productId]).then(r => r[0]);
                 if (poItem) unitCost = Number(poItem.unit_price) || 0;
             }
             
             // STRICT: If no PO or no Price, unitCost matches 0.
             if (unitCost === 0) {
                 console.warn(`[WAC] Warning: Zero cost for Injection. Product=${item.productId}, PO=${note.po_id}`);
             }

             // 2. Fetch Current Stock (Sum of all locations)
             const stockRow = await this.get<any>(tenantId, `SELECT SUM(qty_units) as total FROM current_stock WHERE tenant_id = $1 AND product_id = $2`, [tenantId, item.productId]).then(r => r[0]);
             const currentStock = Number(stockRow?.total) || 0;

             // 3. Fetch Old WAC
             const wacRow = await this.get<any>(tenantId, `SELECT wac FROM product_wac WHERE tenant_id = $1 AND product_id = $2`, [tenantId, item.productId]).then(r => r[0]);
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
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
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
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 `, [movementId, tenantId, item.productId, batch.batchNumber, batch.expiryDate, qty,
                     'QUARANTINE', batch.locationId, 'DELIVERY_INJECTION', noteId, processedBy]);

                 // Update Stock
                 await this.upsertStock(tenantId, item.productId, batch.batchNumber, batch.expiryDate, batch.locationId, qty);
                 
                 // Traceability Layer (With Cost)
                 await this.run(tenantId, `
                    INSERT INTO delivery_note_layers (
                        delivery_note_id, tenant_id, product_id, lot, expiry,
                        qty_received, qty_remaining, purchase_unit_cost
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 `, [dbNoteId, tenantId, item.productId, batch.batchNumber, batch.expiryDate, 
                     qty, qty, unitCost]);
             }
             
             // Removed from batch loop to avoid double processing if items array has dupes (unlikely but safe) (Wait, I loop items, so I should be careful)
             // Optimization: logic assumes items are unique by product ID.
             resultItems.push(item);
         }
         
         // 5. Update Status
         await this.run(tenantId, `UPDATE delivery_notes SET status = 'PROCESSED' WHERE delivery_note_id = $1`, [dbNoteId]);
         
         return { success: true, id: noteId, items: resultItems, processedBy, processedDate: new Date() };
    }

    // NOTE: Legacy replenishment methods removed (getReplenishmentRequests, createReplenishmentRequest, updateReplenishmentRequestStatus)
    // Use stockTransferService.getDemands(), createDemand(), fulfillDemand() instead
    
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

    public async getInventory(tenantId: string, scope?: 'PHARMACY' | 'SERVICE', serviceId?: string): Promise<any[]> {
        console.log(`[getInventory] START - tenant=${tenantId} scope=${scope} serviceId=${serviceId}`);
        
        // Strict scope validation - no implicit defaults!
        // If scope is SERVICE, serviceId is REQUIRED
        if (scope === 'SERVICE' && !serviceId) {
            console.error(`[getInventory] ERROR: SERVICE scope requires serviceId`);
            throw new Error('SERVICE scope requires serviceId parameter');
        }
        
        // Default to PHARMACY if no scope provided (this is for backwards compatibility with Pharmacy page)
        const effectiveScope = scope || 'PHARMACY';
        console.log(`[getInventory] Effective scope: ${effectiveScope}`);
        
        const rows = await this.getStockScoped(tenantId, effectiveScope, serviceId);
        console.log(`[getInventory] Retrieved ${rows.length} stock items`);
        
        return rows.map(r => ({
            ...r,
            theoreticalQty: r.qtyUnits,
            actualQty: r.qtyUnits,
            name: 'MAPPED_FROM_SQL', // TODO: Join with Product Name
            batchNumber: r.lot,
            expiryDate: r.expiry
        }));
    }

    // --- CATALOG (Restored) ---


    public async getCatalogPaginated(tenantId: string, page: number, limit: number, query: string = '', status: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL') {
        const { referenceDataService } = require('./referenceDataService');

        // 1. Fetch Tenant Configs (SQL)
        const dbConfigs = await this.get<any>(tenantId, `SELECT * FROM product_configs WHERE tenant_id = $1`, [tenantId]);


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
            LEFT JOIN product_price_versions ppv ON ps.id = ppv.product_supplier_id AND ppv.valid_to IS NULL
            WHERE ps.tenant_id = $1
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
        const { data: globalProducts, total, totalPages } = await referenceDataService.getProductsPaginated(tenantId, page, limit, query, idsFilter);

        // 4. Reference Data (Suppliers)
        const tenantLocalSuppliers = await this.get<any>(tenantId, `SELECT * FROM suppliers WHERE tenant_id = $1`, [tenantId]); // Only local definitions
        const globalSupplierDefs = await referenceDataService.getSuppliers(tenantId);
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
                    unitSalePrice: s.v_unit_sale_price ?? 0,
                    isActive: s.is_active === true || s.is_active === 1, // Handle PG boolean and SQLite integer
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
            
            // PostgreSQL: Use $1, $2, ... instead of SQLite ?
            const placeholders = productSupplierLinkIds.map((_, i) => `$${i + 1}`).join(',');
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
        return this.get(tenantId, `SELECT * FROM medication_dispense_events WHERE tenant_id = $1 AND prescription_id = $2`, [tenantId, prescriptionId]);
    }

    public async getDispensationsByAdmission(tenantId: string, admissionId: string): Promise<any[]> {
        return this.get(tenantId, `SELECT * FROM medication_dispense_events WHERE tenant_id = $1 AND admission_id = $2`, [tenantId, admissionId]);
    }
    public async resetDB(tenantId: string): Promise<void> {
        // Dev only: Wipes inventory data for tenant? Or all?
        // Since sqlite is shared, maybe only for tenant. But "Clean DB state" implies full wipe often.
        // Let's wipe by tenant to be safe.
        // Tables: current_stock, inventory_movements, purchase_receipts, receipt_layers, supplier_returns, return_lines, medication_dispense_events
        // Locations/Suppliers could be kept? User said "truncate new tables".
        
        await this.run(tenantId, `DELETE FROM current_stock WHERE tenant_id = $1`, [tenantId]);
        await this.run(tenantId, `DELETE FROM inventory_movements WHERE tenant_id = $1`, [tenantId]);
        await this.run(tenantId, `DELETE FROM delivery_note_items WHERE tenant_id = $1`, [tenantId]); // Was receipt_layers
        await this.run(tenantId, `DELETE FROM delivery_note_layers WHERE tenant_id = $1`, [tenantId]); // Was receipt_layers (wait, check mapping)
        await this.run(tenantId, `DELETE FROM delivery_notes WHERE tenant_id = $1`, [tenantId]); // Was purchase_receipts
        await this.run(tenantId, `DELETE FROM supplier_return_lines WHERE tenant_id = $1`, [tenantId]);
        await this.run(tenantId, `DELETE FROM supplier_returns WHERE tenant_id = $1`, [tenantId]);
        await this.run(tenantId, `DELETE FROM medication_dispense_events WHERE tenant_id = $1`, [tenantId]);
        // Also wipe locations/suppliers if requested? "Clean state". Maybe not.
    }
}

export const pharmacyService = PharmacyService.getInstance();
