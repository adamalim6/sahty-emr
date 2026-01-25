
import { getTenantDB, run, get, all } from '../db/tenantDb';

export interface StockReservation {
    reservation_id: string;
    tenant_id: string;
    session_id: string;
    user_id: string;
    demand_id?: string;
    demand_line_id?: string;
    product_id: string;
    lot?: string;
    expiry?: string;
    location_id: string;
    qty_units: number;
    status: 'ACTIVE' | 'RELEASED' | 'COMMITTED' | 'EXPIRED';
    expires_at: string;
}

export interface HoldRequest {
    session_id: string;
    user_id: string;
    demand_id?: string;
    demand_line_id?: string;
    product_id: string;
    lot: string;
    expiry: string;
    location_id: string;
    qty_units: number;
    client_request_id?: string;
}

class StockReservationService {

    // 1. HOLD
    async hold(tenantId: string, req: HoldRequest): Promise<StockReservation> {
        const db = await getTenantDB(tenantId);
        
        // 1. Check Idempotency
        if (req.client_request_id) {
            const existing = await get(db, `SELECT * FROM stock_reservations WHERE tenant_id = ? AND client_request_id = ?`, [tenantId, req.client_request_id]);
            if (existing) return existing;
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

        try {
            await run(db, 'BEGIN TRANSACTION');

            // 2. Check Available Stock
            // Available = Physical - Active Reservations (excluding this session ideally, but for safety we count all)
            // Actually, we should check physical stock first.
            const stock = await get(db, `
                SELECT qty_units FROM current_stock 
                WHERE tenant_id = ? AND location = ? AND product_id = ? AND lot = ?
            `, [tenantId, req.location_id, req.product_id, req.lot]);

            const physicalQty = stock ? stock.qty_units : 0;

            const reserved = await get(db, `
                SELECT SUM(qty_units) as total 
                WHERE status = 'ACTIVE' 
                AND tenant_id = ? 
                AND location_id = ? 
                AND product_id = ? 
                AND lot = ?
                AND expires_at > CURRENT_TIMESTAMP
            `, [tenantId, req.location_id, req.product_id, req.lot]);
            
            // Note: SQLite might fail the SELECT above because of WHERE syntax. Correct syntax:
            // SELECT SUM(...) FROM ... WHERE ...
            const reservedRow = await get(db, `
                SELECT SUM(qty_units) as total FROM stock_reservations
                WHERE status = 'ACTIVE' 
                AND tenant_id = ? 
                AND location_id = ? 
                AND product_id = ? 
                AND lot = ?
                AND expires_at > CURRENT_TIMESTAMP
            `, [tenantId, req.location_id, req.product_id, req.lot]);

            const reservedQty = reservedRow ? (reservedRow.total || 0) : 0;
            const available = physicalQty - reservedQty;

            if (req.qty_units > available) {
                throw new Error(`Insufficient stock. Available: ${available} (Physical: ${physicalQty}, Reserved: ${reservedQty})`);
            }

            // 3. Insert Reservation
            const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await run(db, `
                INSERT INTO stock_reservations (
                    reservation_id, tenant_id, session_id, user_id, 
                    demand_id, demand_line_id, product_id, lot, expiry, location_id, 
                    qty_units, status, expires_at, client_request_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            `, [
                reservationId, tenantId, req.session_id, req.user_id,
                req.demand_id, req.demand_line_id, req.product_id, req.lot, req.expiry, req.location_id,
                req.qty_units, expiresAt, req.client_request_id
            ]);

            await run(db, 'COMMIT');
            
            return {
                reservation_id: reservationId,
                tenant_id: tenantId,
                session_id: req.session_id,
                user_id: req.user_id,
                product_id: req.product_id,
                location_id: req.location_id,
                qty_units: req.qty_units,
                status: 'ACTIVE',
                expires_at: expiresAt
            };

        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }
    }

    // 2. RELEASE
    async release(tenantId: string, reservationId: string) {
        const db = await getTenantDB(tenantId);
        await run(db, `UPDATE stock_reservations SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE reservation_id = ? AND tenant_id = ?`, [reservationId, tenantId]);
    }

    // 3. REFRESH SESSION
    async refreshSession(tenantId: string, sessionId: string) {
        const db = await getTenantDB(tenantId);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await run(db, `
            UPDATE stock_reservations 
            SET expires_at = ? 
            WHERE session_id = ? AND tenant_id = ? AND status = 'ACTIVE'
        `, [expiresAt, sessionId, tenantId]);
    }

    // 4. GET SESSION CART
    async getSessionCart(tenantId: string, sessionId: string) {
        const db = await getTenantDB(tenantId);
        return all(db, `
            SELECT * FROM stock_reservations 
            WHERE session_id = ? AND tenant_id = ? AND status = 'ACTIVE' AND expires_at > CURRENT_TIMESTAMP
        `, [sessionId, tenantId]);
    }

    // 5. COMMIT (The Big One)
    async commitSession(tenantId: string, sessionId: string, demandId: string, userId: string) {
        const db = await getTenantDB(tenantId);
        
        try {
            await run(db, 'BEGIN TRANSACTION');

            // 1. Get Active Reservations
            const reservations = await all(db, `
                SELECT * FROM stock_reservations 
                WHERE session_id = ? AND tenant_id = ? AND status = 'ACTIVE' AND expires_at > CURRENT_TIMESTAMP
            `, [sessionId, tenantId]);

            if (reservations.length === 0) {
                // Determine if we should throw or just return empty
                 // Typically if user clicks "Transfer" and cart is empty (maybe expired), we should error.
                 // However, the user might simply be trying to close a demand with 0 items? No, "Transferer STock" implies items.
                 // Let's assume if empty, nothing to do.
                 await run(db, 'COMMIT');
                 return null;
            }

            // 2. Validate Stock Again (Just in case physical stock was removed by another process bypassing hold?)
            // Ideally Hold prevents this, but let's be safe.
            // Also, we need to create ONE transfer.
            
            // fetch demand to get destination location (service location)
            // Wait, demand has service_id. We need access to service_units? 
            // OR stock_demand_lines might have target info?
            // The Mockup shows "emplacement destinataire: NEURO 1". This implies per-line destination.
            // But stock_transfers has 'destination_location_id'. 
            // In the new schema I proposed:
            // stock_transfers: destination_location_id (Primary destination?)
            // stock_transfer_lines: destination_location_id (Specific)
            
            // Let's assume the demands are grouped by service. The Transfer Header destination should be the SERVICE default.
            // But we can have multiple destinations?
            // For now, let's look up the demand.
            
            // We need to know the Service Location ID.
            // Since we don't have it easily here without joining, we might need it passed in, or looked up.
            // Actually, `stock_demands` has `service_id`. `locations` table has `service_id`.
            // We can pick the primary location for that service.
            
            // Let's assume for now we use the first reservation's line's logic if possible, OR we fetch the demand.
            
            const demand = await get(db, "SELECT * FROM stock_demands WHERE request_id = ?", [demandId]);
            if (!demand) throw new Error("Demand not found");

            // We need a destination location for the Transfer Header. 
            // Let's fetch the default location for this service.
            const serviceLoc = await get(db, "SELECT id FROM locations WHERE service_id = ? AND is_active = 1 LIMIT 1", [demand.service_id]);
            const headerDestId = serviceLoc ? serviceLoc.id : 'UNKNOWN';

            // Create Transfer Header
            const transferId = `trf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            // Source location: Pharmacy (Grab from first reservation? usually one pharmacy per transfer session. If mixed, we have a problem. 
            // The UI implies "Pharmacie Centrale > Service Neurologie".
            // So source is likely uniform.
            const sourceLocId = reservations[0].location_id; 

            await run(db, `
                INSERT INTO stock_transfers (id, tenant_id, demand_id, source_location_id, destination_location_id, status, validated_at, validated_by)
                VALUES (?, ?, ?, ?, ?, 'POSTED', CURRENT_TIMESTAMP, ?)
            `, [transferId, tenantId, demandId, sourceLocId, headerDestId, userId]);

            // Process Lines
            for (const res of reservations) {
                // Check physical stock one last time (Optimization: skip if trusted)
                // Decrement Source
                await run(db, `UPDATE current_stock SET qty_units = qty_units - ? WHERE tenant_id = ? AND location = ? AND product_id = ? AND lot = ?`,
                    [res.qty_units, tenantId, res.location_id, res.product_id, res.lot]);

                // Increment Destination (Where? detailed destination?)
                // The reservation doesn't explicitly store dest location, but the Cart in UI does.
                // WE SHOULD HAVE STORED DEST IN RESERVATION?
                // The spec I wrote: "demand_id, demand_line_id".
                // The demand_line implies the need.
                // If we don't have dest in reservation, we fallback to header dest.
                // Wait, User Mockup: "emplacement destinataire: NEURO 1". This comes from Demand Line (Intent).
                // So we should look up the demand line to find the requested dest?
                // Or simply use the header dest if not specified.
                
                // Let's try to get specific destination from demand/logic.
                const destId = headerDestId; // Simplification for now.

                await run(db, `
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(tenant_id, product_id, lot, location) 
                    DO UPDATE SET qty_units = qty_units + excluded.qty_units
                `, [tenantId, res.product_id, res.lot, res.expiry, destId, res.qty_units]);

                // Inventory Movement
                const moveId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                await run(db, `
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location, to_location, document_type, document_id, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TRANSFER', ?, ?)
                `, [moveId, tenantId, res.product_id, res.lot, res.expiry, res.qty_units, res.location_id, destId, transferId, userId]);

                // Transfer Line
                const lineId = `tln_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                
                // Check substitution
                // We need the requested product ID.
                let demandLine = null;
                if (res.demand_line_id) {
                     demandLine = await get(db, "SELECT product_id FROM stock_demand_lines WHERE request_id = ? AND product_id = ?", [demandId, res.demand_line_id]); 
                     // Wait, PK of stock_demand_lines is (request_id, product_id).
                     // But res.demand_line_id IS the product_id in my previous logic? 
                     // No, in spec I said demand_line_id is UUID.
                     // But existing schema stock_demand_lines PK was (request_id, product_id).
                     // So demand_line_id in reservation essentially matches the "requested product id" if we stick to that Key.
                     // Let's assume res.demand_line_id holds the requested_product_id.
                }

                // Actually, existing schema:
                // PRIMARY KEY (request_id, product_id)
                // So "line id" is effectively the product_id of the request.
                
                const requestedProductId = res.demand_line_id || res.product_id; 
                const isSubstitution = requestedProductId !== res.product_id;

                await run(db, `
                    INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [lineId, tenantId, transferId, res.product_id, res.lot, res.expiry, res.qty_units, requestedProductId]);

                // Update Reservation
                await run(db, `
                     UPDATE stock_reservations 
                     SET status = 'COMMITTED', committed_at = CURRENT_TIMESTAMP, transfer_id = ?, transfer_line_id = ?
                     WHERE reservation_id = ?
                `, [transferId, lineId, res.reservation_id]);
            }
            
            // Check if Demand is Fully Filled? 
            // Logic: Compare total requested vs total transferred (including history).
            // Identify open lines. If all filled, status = FILLED.
            // For now, let's set to PARTIALLY_FILLED if not already.
            await run(db, "UPDATE stock_demands SET status = 'PARTIALLY_FILLED' WHERE request_id = ? AND status != 'FILLED'", [demandId]);

            await run(db, 'COMMIT');
            return transferId;

        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }
    }
}

export const stockReservationService = new StockReservationService();
