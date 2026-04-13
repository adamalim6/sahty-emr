/**
 * TIER 2: Stock Reservation Engine with Header + Lines Model
 * 
 * ARCHITECTURE:
 * - stock_reservations = HEADER (one per cart/session, document-level fields only)
 * - stock_reservation_lines = LINES (editable cart items with product/lot/qty)
 * 
 * CRITICAL INVARIANTS:
 * - Reservations = INTENT (upstream of execution)
 * - hold() updates reserved_units on current_stock
 * - Only commitSession() modifies current_stock.qty_units
 * - Delta-based locking: add → +qty, update → +(new-old), delete → -qty
 * - Status: ACTIVE | RELEASED | COMMITTED
 * 
 * @module stockReservationService
 */

import { v4 as uuidv4 } from 'uuid';
import { tenantQuery, tenantQueryOne, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ReservationHeader {
    reservation_id: string;
    tenant_id: string;
    session_id: string;
    user_id: string;
    stock_demand_id?: string;
    status: 'ACTIVE' | 'RELEASED' | 'COMMITTED';
    reserved_at: string;
    expires_at: string;
    released_at?: string;
    committed_at?: string;
}

export interface ReservationLine {
    id: string;
    reservation_id: string;
    tenant_id: string;
    stock_demand_line_id?: string;
    product_id: string;
    lot: string;
    expiry: string;
    source_location_id: string;
    destination_location_id?: string;
    qty_units: number;
    created_at: string;
}

export interface HoldRequest {
    session_id: string;
    user_id: string;
    stock_demand_id?: string;
    stock_demand_line_id?: string;
    product_id: string;
    lot: string;
    expiry: string;
    source_location_id: string;
    destination_location_id?: string;
    qty_units: number;
}

export interface SessionCart {
    header: ReservationHeader;
    lines: ReservationLine[];
}

// Legacy interface for backward compatibility
export interface StockReservation extends ReservationLine {
    session_id: string;
    user_id: string;
    status: 'ACTIVE' | 'RELEASED' | 'COMMITTED';
    expires_at: string;
}

// ============================================================================
// SERVICE
// ============================================================================

class StockReservationService {

    /**
     * 1. HOLD - Add item to cart
     * 
     * Creates header if new session, then adds line.
     * Updates current_stock.reserved_units += qty
     */
    async hold(tenantId: string, req: HoldRequest): Promise<ReservationLine> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

            // 1. Get or create reservation header for this session
            let header = await client.query(`
                SELECT reservation_id FROM stock_reservations 
                WHERE tenant_id = $1 AND session_id = $2 AND status = 'ACTIVE'
            `, [tenantId, req.session_id]);

            let reservationId: string;
            if (header.rows.length === 0) {
                // Create new header
                reservationId = uuidv4();
                await client.query(`
                    INSERT INTO stock_reservations (
                        reservation_id, tenant_id, session_id, user_id, 
                        stock_demand_id, status, reserved_at, expires_at
                    ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), $6)
                `, [reservationId, tenantId, req.session_id, req.user_id, 
                    req.stock_demand_id || null, expiresAt]);
            } else {
                reservationId = header.rows[0].reservation_id;
                // Refresh expiry
                await client.query(`
                    UPDATE stock_reservations SET expires_at = $1 WHERE reservation_id = $2
                `, [expiresAt, reservationId]);
            }

            // 2. Resolve Destination Location (Propagate from Demand Line if exists)
            let resolvedDestinationId = req.destination_location_id || null;
            if (req.stock_demand_line_id) {
                const demandLineRes = await client.query(`
                    SELECT target_stock_location_id FROM stock_demand_lines 
                    WHERE id = $1 AND tenant_id = $2
                `, [req.stock_demand_line_id, tenantId]);
                
                if (demandLineRes.rows.length > 0 && demandLineRes.rows[0].target_stock_location_id) {
                    resolvedDestinationId = demandLineRes.rows[0].target_stock_location_id;
                }
            }

            // 3. Check for Existing Line (Merge Logic)
            // Determine if we update an existing line or insert a new one
            const existingLineRes = await client.query(`
                SELECT id, qty_units FROM stock_reservation_lines
                WHERE reservation_id = $1 
                  AND product_id = $2
                  AND lot = $3
                  AND expiry = $4
                  AND source_location_id = $5
                  AND (destination_location_id = $6 OR (destination_location_id IS NULL AND $6 IS NULL))
                  AND tenant_id = $7
                FOR UPDATE
            `, [reservationId, req.product_id, req.lot, req.expiry, req.source_location_id, resolvedDestinationId, tenantId]);

            // 4. Lock current_stock row FOR UPDATE & Check Availability
            const stockResult = await client.query(`
                SELECT qty_units, reserved_units FROM current_stock 
                WHERE tenant_id = $1 AND location_id = $2 AND product_id = $3 AND lot = $4 AND expiry = $5
                FOR UPDATE
            `, [tenantId, req.source_location_id, req.product_id, req.lot, req.expiry]);

            const physicalQty = stockResult.rows.length > 0 ? stockResult.rows[0].qty_units : 0;
            const currentReserved = stockResult.rows.length > 0 ? (stockResult.rows[0].reserved_units || 0) : 0;
            const available = physicalQty - currentReserved;

            // Check availability against the NEW delta
            if (req.qty_units > available) {
                throw new Error(`INSUFFICIENT_AVAILABLE_STOCK: Requested ${req.qty_units}, available ${available} (physical: ${physicalQty}, reserved: ${currentReserved})`);
            }

            let finalLineId: string;
            let finalQty: number;

            if (existingLineRes.rows.length > 0) {
                // UPDATE existing line
                finalLineId = existingLineRes.rows[0].id;
                finalQty = existingLineRes.rows[0].qty_units + req.qty_units;
                
                await client.query(`
                    UPDATE stock_reservation_lines SET qty_units = $1 WHERE id = $2
                `, [finalQty, finalLineId]);
            } else {
                // INSERT new line
                finalLineId = uuidv4();
                finalQty = req.qty_units;
                
                await client.query(`
                    INSERT INTO stock_reservation_lines (
                        id, reservation_id, tenant_id, stock_demand_line_id,
                        product_id, lot, expiry, source_location_id, destination_location_id, qty_units
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [finalLineId, reservationId, tenantId, req.stock_demand_line_id || null,
                    req.product_id, req.lot, req.expiry, req.source_location_id, 
                    resolvedDestinationId, req.qty_units]);
            }

            // 5. Update reserved_units (delta: +qty)
            await client.query(`
                UPDATE current_stock 
                SET reserved_units = COALESCE(reserved_units, 0) + $1
                WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
            `, [req.qty_units, tenantId, req.source_location_id, req.product_id, req.lot, req.expiry]);

            return {
                id: finalLineId,
                reservation_id: reservationId,
                tenant_id: tenantId,
                stock_demand_line_id: req.stock_demand_line_id,
                product_id: req.product_id,
                lot: req.lot,
                expiry: req.expiry,
                source_location_id: req.source_location_id,
                destination_location_id: resolvedDestinationId || undefined,
                qty_units: finalQty,
                created_at: new Date().toISOString()
            };
        });
    }

    /**
     * 2. UPDATE LINE - Modify quantity (delta-based)
     * 
     * reserved_units += (new_qty - old_qty)
     */
    async updateLine(tenantId: string, lineId: string, newQty: number): Promise<ReservationLine> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Get existing line (lock)
            const lineResult = await client.query(`
                SELECT l.*, r.status FROM stock_reservation_lines l
                JOIN stock_reservations r ON l.reservation_id = r.reservation_id
                WHERE l.id = $1 AND l.tenant_id = $2
                FOR UPDATE
            `, [lineId, tenantId]);

            if (lineResult.rows.length === 0) {
                throw new Error(`Line ${lineId} not found`);
            }
            const line = lineResult.rows[0];

            if (line.status !== 'ACTIVE') {
                throw new Error(`Cannot modify line in ${line.status} reservation`);
            }

            const oldQty = line.qty_units;
            const delta = newQty - oldQty;

            if (delta > 0) {
                // Increasing: check availability
                const stockResult = await client.query(`
                    SELECT qty_units, reserved_units FROM current_stock 
                    WHERE tenant_id = $1 AND location_id = $2 AND product_id = $3 AND lot = $4 AND expiry = $5
                    FOR UPDATE
                `, [tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);

                const physical = stockResult.rows[0]?.qty_units || 0;
                const reserved = stockResult.rows[0]?.reserved_units || 0;
                const available = physical - reserved;

                if (delta > available) {
                    throw new Error(`INSUFFICIENT_AVAILABLE_STOCK: Cannot increase by ${delta}, available ${available}`);
                }
            }

            // 2. Update line
            await client.query(`
                UPDATE stock_reservation_lines SET qty_units = $1 WHERE id = $2
            `, [newQty, lineId]);

            // 3. Apply delta to reserved_units
            await client.query(`
                UPDATE current_stock 
                SET reserved_units = COALESCE(reserved_units, 0) + $1
                WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
            `, [delta, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);

            return { ...line, qty_units: newQty };
        });
    }

    /**
     * 3. RELEASE LINE - Remove item from cart
     * 
     * Deletes line and decrements reserved_units
     */
    async release(tenantId: string, lineId: string): Promise<void> {
        await tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Get and lock the line
            const lineResult = await client.query(`
                SELECT l.*, r.status FROM stock_reservation_lines l
                JOIN stock_reservations r ON l.reservation_id = r.reservation_id
                WHERE l.id = $1 AND l.tenant_id = $2
                FOR UPDATE
            `, [lineId, tenantId]);

            if (lineResult.rows.length === 0) return;
            const line = lineResult.rows[0];

            if (line.status !== 'ACTIVE') return; // Already released/committed

            // 2. Delete line
            await client.query(`DELETE FROM stock_reservation_lines WHERE id = $1`, [lineId]);

            // 3. Decrement reserved_units
            await client.query(`
                UPDATE current_stock 
                SET reserved_units = GREATEST(0, COALESCE(reserved_units, 0) - $1)
                WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
            `, [line.qty_units, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);
        });
    }

    /**
     * 4. RELEASE SESSION - Cancel entire cart
     * 
     * Marks header RELEASED, deletes all lines, zeros reserved_units
     */
    async releaseSession(tenantId: string, sessionId: string): Promise<number> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Get header
            const headerResult = await client.query(`
                SELECT reservation_id FROM stock_reservations 
                WHERE tenant_id = $1 AND session_id = $2 AND status = 'ACTIVE'
                FOR UPDATE
            `, [tenantId, sessionId]);

            if (headerResult.rows.length === 0) return 0;
            const reservationId = headerResult.rows[0].reservation_id;

            // 2. Get all lines
            const lines = await client.query(`
                SELECT * FROM stock_reservation_lines WHERE reservation_id = $1
            `, [reservationId]);

            // 3. Decrement reserved_units for each line
            for (const line of lines.rows) {
                await client.query(`
                    UPDATE current_stock 
                    SET reserved_units = GREATEST(0, COALESCE(reserved_units, 0) - $1)
                    WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
                `, [line.qty_units, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);
            }

            // 4. Delete all lines
            await client.query(`DELETE FROM stock_reservation_lines WHERE reservation_id = $1`, [reservationId]);

            // 5. Mark header RELEASED
            await client.query(`
                UPDATE stock_reservations 
                SET status = 'RELEASED', released_at = NOW() 
                WHERE reservation_id = $1
            `, [reservationId]);

            return lines.rows.length;
        });
    }

    /**
     * 5. REFRESH SESSION - Extend expiry
     */
    async refreshSession(tenantId: string, sessionId: string): Promise<void> {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await tenantQuery(tenantId, `
            UPDATE stock_reservations 
            SET expires_at = $1 
            WHERE session_id = $2 AND tenant_id = $3 AND status = 'ACTIVE'
        `, [expiresAt, sessionId, tenantId]);
    }

    /**
     * 6. GET SESSION CART - Returns header + lines
     */
    async getSessionCart(tenantId: string, sessionId: string): Promise<SessionCart | null> {
        const headerRow = await tenantQueryOne(tenantId, `
            SELECT * FROM stock_reservations 
            WHERE session_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()
        `, [sessionId, tenantId]);

        if (!headerRow) return null;

        const lines = await tenantQuery(tenantId, `
            SELECT * FROM stock_reservation_lines 
            WHERE reservation_id = $1 
            ORDER BY product_id, lot
        `, [headerRow.reservation_id]);

        return {
            header: this.mapHeader(headerRow),
            lines: lines.map(r => this.mapLine(r))
        };
    }

    /**
     * Get active reservation for a demand (for Cart Persistence/Hydration)
     */
    async getActiveReservationForDemand(tenantId: string, demandId: string): Promise<SessionCart | null> {
        const headerRow = await tenantQueryOne(tenantId, `
            SELECT * FROM stock_reservations 
            WHERE tenant_id = $1 AND stock_demand_id = $2 AND status = 'ACTIVE'
        `, [tenantId, demandId]);

        if (!headerRow) return null;

        const lines = await tenantQuery(tenantId, `
            SELECT * FROM stock_reservation_lines
            WHERE reservation_id = $1
            ORDER BY product_id, lot
        `, [headerRow.reservation_id]);

        return {
            header: this.mapHeader(headerRow),
            lines: lines.map(r => this.mapLine(r))
        };
    }

    /**
     * 7. COMMIT SESSION - The Atomic Posting Contract
     * 
     * INVARIANTS (DO NOT VIOLATE):
     * - Stock never changes without a transfer document
     * - Reserved stock is always consumed exactly once
     * - Reservation → Execution → Inventory movement is one-way
     * - Execution documents point to reservation lines, never the reverse
     * 
     * TRANSACTION ORDER (DO NOT CHANGE):
     * 1. Load and lock reservation by demandId
     * 2. Load and lock reservation lines
     * 3. Create stock_transfer header (BEFORE stock mutation)
     * 4. Create stock_transfer_lines (BEFORE stock mutation)
     * 5. Apply stock mutation (THE PHYSICAL EFFECT)
     * 6. Write inventory_movements
     * 7. Mark reservation as COMMITTED
     * 8. Unlock demand (processing_status = 'OPEN')
     * 9. Commit transaction
     */
    async commitSession(
        tenantId: string, 
        sessionId: string, 
        demandId: string, 
        userId: string
    ): Promise<string | null> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // ================================================================
            // IDEMPOTENCY CHECK - Return existing transfer if already committed
            // ================================================================
            const existing = await client.query(
                `SELECT id FROM stock_transfers WHERE tenant_id = $1 AND demand_id = $2 AND status = 'VALIDATED'`,
                [tenantId, demandId]
            );
            if (existing.rows.length > 0) {
                return existing.rows[0].id;
            }

            // ================================================================
            // 1️⃣ LOAD AND VALIDATE THE ACTIVE RESERVATION (by demandId)
            // ================================================================
            const headerResult = await client.query(`
                SELECT * FROM stock_reservations 
                WHERE tenant_id = $1 AND stock_demand_id = $2 AND status = 'ACTIVE'
                FOR UPDATE
            `, [tenantId, demandId]);

            if (headerResult.rows.length === 0) {
                throw new Error(`No active reservation found for demand ${demandId}`);
            }
            const header = headerResult.rows[0];

            // Verify reservation is not already committed or released
            if (header.status !== 'ACTIVE') {
                throw new Error(`Reservation ${header.reservation_id} is ${header.status}, cannot commit`);
            }

            // ================================================================
            // 2️⃣ LOAD AND LOCK RESERVATION LINES (single source of truth)
            // ================================================================
            const linesResult = await client.query(`
                SELECT * FROM stock_reservation_lines 
                WHERE reservation_id = $1 
                ORDER BY source_location_id, product_id, lot, expiry
                FOR UPDATE
            `, [header.reservation_id]);

            if (linesResult.rows.length === 0) {
                throw new Error(`No reservation lines found for reservation ${header.reservation_id}`);
            }
            const lines = linesResult.rows;

            // ================================================================
            // RESOLVE DESTINATION LOCATION (from demand's service)
            // ================================================================
            const demand = await client.query(`SELECT * FROM stock_demands WHERE id = $1`, [demandId]);
            if (demand.rows.length === 0) {
                throw new Error(`Demand ${demandId} not found`);
            }

            const serviceLoc = await client.query(
                `SELECT location_id as id FROM locations WHERE service_id = $1 AND status = 'ACTIVE' LIMIT 1`,
                [demand.rows[0].service_id]
            );
            const fallbackDestId = serviceLoc.rows.length > 0 ? serviceLoc.rows[0].id : null;
            
            if (!fallbackDestId) {
                throw new Error(`No active location found for service ${demand.rows[0].service_id}`);
            }

            // Use first line's source as the header source
            const sourceLocId = lines[0].source_location_id;

            // ================================================================
            // 3️⃣ CREATE STOCK_TRANSFER HEADER (BEFORE touching stock)
            // ================================================================
            const transferId = uuidv4();
            await client.query(`
                INSERT INTO stock_transfers (
                    id, tenant_id, demand_id, 
                    status, validated_at, validated_by, stock_reservation_id
                ) VALUES ($1, $2, $3, 'VALIDATED', NOW(), $4, $5)
            `, [transferId, tenantId, demandId, userId, header.reservation_id]);

            // ================================================================
            // 4️⃣ CREATE STOCK_TRANSFER_LINES (BEFORE stock mutation)
            // ================================================================
            const transferLineIds: Map<string, string> = new Map(); // reservationLineId -> transferLineId

            for (const line of lines) {
                const destId = line.destination_location_id || fallbackDestId;
                const transferLineId = uuidv4();
                transferLineIds.set(line.id, transferLineId);

                await client.query(`
                    INSERT INTO stock_transfer_lines (
                        id, tenant_id, transfer_id, product_id, lot, expiry, 
                        qty_transferred, source_location_id, destination_location_id, 
                        demand_line_id, reservation_line_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [transferLineId, tenantId, transferId, line.product_id, line.lot, line.expiry, 
                    line.qty_units, line.source_location_id, destId, 
                    line.stock_demand_line_id || null, line.id]);
            }

            // ================================================================
            // 5️⃣ APPLY STOCK MUTATION (THE PHYSICAL EFFECT)
            // ================================================================
            for (const line of lines) {
                const take = line.qty_units;
                const destId = line.destination_location_id || fallbackDestId;

                // 5a. Decrement source stock (qty_units AND reserved_units)
                const decResult = await client.query(`
                    UPDATE current_stock
                    SET qty_units = qty_units - $1,
                        reserved_units = GREATEST(0, COALESCE(reserved_units, 0) - $1)
                    WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
                      AND qty_units >= $1
                      AND COALESCE(reserved_units, 0) >= $1
                    RETURNING qty_units, reserved_units
                `, [take, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);

                if (decResult.rowCount === 0) {
                    throw new Error(`STALE_RESERVATION: Insufficient stock or reserved_units for product ${line.product_id}, lot ${line.lot}. Expected to consume ${take} units.`);
                }

                // 5b. Upsert destination stock
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, expiry, location_id) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, line.product_id, line.lot, line.expiry, destId, take]);
            }

            // ================================================================
            // 6️⃣ WRITE INVENTORY_MOVEMENTS (after stock mutation)
            // ================================================================
            for (const line of lines) {
                const take = line.qty_units;
                const destId = line.destination_location_id || fallbackDestId;
                const transferLineId = transferLineIds.get(line.id)!;

                await client.query(`
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location_id, to_location_id, document_type, document_id, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TRANSFER', $9, $10)
                `, [uuidv4(), tenantId, line.product_id, line.lot, line.expiry, take, 
                    line.source_location_id, destId, transferId, userId]);
            }

            // ================================================================
            // 7️⃣ MARK RESERVATION AS COMMITTED (immutable from now on)
            // ================================================================
            await client.query(`
                UPDATE stock_reservations 
                SET status = 'COMMITTED', committed_at = NOW() 
                WHERE reservation_id = $1
            `, [header.reservation_id]);

            // ================================================================
            // 8️⃣ UNLOCK DEMAND (processing_status = OPEN, release lock)
            // ================================================================
            await client.query(`
                UPDATE stock_demands 
                SET 
                    status = 'PARTIALLY_FILLED',
                    processing_status = 'OPEN',
                    assigned_user_id = NULL,
                    updated_at = NOW()
                WHERE id = $1 AND status NOT IN ('FILLED', 'CANCELLED')
            `, [demandId]);

            // ================================================================
            // FINAL INVARIANT CHECK (fail-safe)
            // ================================================================
            const negCheck = await client.query(
                `SELECT COUNT(*) as cnt FROM current_stock WHERE tenant_id = $1 AND qty_units < 0`,
                [tenantId]
            );
            if (parseInt(negCheck.rows[0].cnt) > 0) {
                throw new Error(`INVARIANT_VIOLATION: Negative stock detected after commit`);
            }

            // ================================================================
            // 9️⃣ RETURN TRANSFER ID (transaction commits here)
            // ================================================================
            return transferId;
        });
    }

    /**
     * EXPIRE STALE - Housekeeping job
     */
    async expireStaleReservations(tenantId: string): Promise<number> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Find expired headers
            const expired = await client.query(`
                SELECT reservation_id FROM stock_reservations 
                WHERE tenant_id = $1 AND status = 'ACTIVE' AND expires_at < NOW()
                FOR UPDATE
            `, [tenantId]);

            let count = 0;
            for (const row of expired.rows) {
                // Get lines
                const lines = await client.query(
                    `SELECT * FROM stock_reservation_lines WHERE reservation_id = $1`,
                    [row.reservation_id]
                );

                // Release reserved_units
                for (const line of lines.rows) {
                    await client.query(`
                        UPDATE current_stock 
                        SET reserved_units = GREATEST(0, COALESCE(reserved_units, 0) - $1)
                        WHERE tenant_id = $2 AND location = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
                    `, [line.qty_units, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);
                }

                // Delete lines
                await client.query(`DELETE FROM stock_reservation_lines WHERE reservation_id = $1`, [row.reservation_id]);

                // Mark RELEASED
                await client.query(`
                    UPDATE stock_reservations SET status = 'RELEASED', released_at = NOW() WHERE reservation_id = $1
                `, [row.reservation_id]);

                count++;
            }

            return count;
        });
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private mapHeader(row: any): ReservationHeader {
        return {
            reservation_id: row.reservation_id,
            tenant_id: row.tenant_id,
            session_id: row.session_id,
            user_id: row.user_id,
            stock_demand_id: row.stock_demand_id,
            status: row.status,
            reserved_at: row.reserved_at,
            expires_at: row.expires_at,
            released_at: row.released_at,
            committed_at: row.committed_at
        };
    }

    private mapLine(row: any): ReservationLine {
        return {
            id: row.id,
            reservation_id: row.reservation_id,
            tenant_id: row.tenant_id,
            stock_demand_line_id: row.stock_demand_line_id,
            product_id: row.product_id,
            lot: row.lot,
            expiry: row.expiry,
            source_location_id: row.source_location_id,
            destination_location_id: row.destination_location_id,
            qty_units: row.qty_units,
            created_at: row.created_at
        };
    }
}

export const stockReservationService = new StockReservationService();
