/**
 * TIER 2: Stock Reservation Engine with Atomic Commit Contract
 * 
 * CRITICAL INVARIANTS:
 * - hold() NEVER modifies current_stock
 * - Only commitSession() modifies current_stock (via guarded atomic updates)
 * - Lock order: stock_reservations → current_stock (sorted) → stock_transfers → inventory_movements
 * - qty_units >= 0 enforced by database CHECK constraint
 * 
 * @module stockReservationService
 */

import { v4 as uuidv4 } from 'uuid';
import { tenantQuery, tenantQueryOne, tenantTransaction, getTenantPool } from '../db/tenantPg';
import { PoolClient } from 'pg';

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
    destination_location_id?: string;  // Target location for transfer
    client_request_id?: string;
}

class StockReservationService {

    /**
     * 1. HOLD - Reserve stock for a session
     * 
     * RULES:
     * - MUST NOT modify current_stock
     * - MUST enforce availability using SQL, not Node read/modify/write
     * - MUST lock in stable order: current_stock (FOR UPDATE) → stock_reservations
     * - Insert only if (physical - active_reservations) >= requested
     */
    async hold(tenantId: string, req: HoldRequest): Promise<StockReservation> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Idempotency check
            if (req.client_request_id) {
                const existing = await client.query(
                    `SELECT * FROM stock_reservations WHERE tenant_id = $1 AND client_request_id = $2`,
                    [tenantId, req.client_request_id]
                );
                if (existing.rows.length > 0) {
                    return this.mapReservation(existing.rows[0]);
                }
            }

            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

            // 2. Lock current_stock row FOR UPDATE (prevents concurrent modification)
            // Row identity: (tenant_id, location, product_id, lot, expiry)
            const stockResult = await client.query(`
                SELECT qty_units FROM current_stock 
                WHERE tenant_id = $1 AND location = $2 AND product_id = $3 AND lot = $4 AND expiry = $5
                FOR UPDATE
            `, [tenantId, req.location_id, req.product_id, req.lot, req.expiry]);

            const physicalQty = stockResult.rows.length > 0 ? stockResult.rows[0].qty_units : 0;

            // 3. Calculate active reservations for this exact lot+expiry
            const reservedResult = await client.query(`
                SELECT COALESCE(SUM(qty_units), 0) as total 
                FROM stock_reservations
                WHERE status = 'ACTIVE' 
                AND tenant_id = $1 
                AND location_id = $2 
                AND product_id = $3 
                AND lot = $4
                AND expiry = $5
                AND expires_at > NOW()
            `, [tenantId, req.location_id, req.product_id, req.lot, req.expiry]);

            const reservedQty = parseInt(reservedResult.rows[0].total) || 0;
            const available = physicalQty - reservedQty;

            if (req.qty_units > available) {
                throw new Error(`INSUFFICIENT_AVAILABLE_STOCK: Requested ${req.qty_units}, available ${available} (physical: ${physicalQty}, reserved: ${reservedQty})`);
            }

            // 4. Insert reservation (does NOT modify current_stock)
            const reservationId = uuidv4(); // Pure UUID for schema compatibility
            await client.query(`
                INSERT INTO stock_reservations (
                    reservation_id, tenant_id, session_id, user_id, 
                    demand_id, demand_line_id, product_id, lot, expiry, location_id, 
                    destination_location_id, qty_units, status, expires_at, client_request_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', $13, $14)
            `, [
                reservationId, tenantId, req.session_id, req.user_id,
                req.demand_id || null, req.demand_line_id || null, 
                req.product_id, req.lot, req.expiry, req.location_id,
                req.destination_location_id || null, req.qty_units, expiresAt, req.client_request_id || null
            ]);

            return {
                reservation_id: reservationId,
                tenant_id: tenantId,
                session_id: req.session_id,
                user_id: req.user_id,
                demand_id: req.demand_id,
                demand_line_id: req.demand_line_id,
                product_id: req.product_id,
                lot: req.lot,
                expiry: req.expiry,
                location_id: req.location_id,
                qty_units: req.qty_units,
                status: 'ACTIVE',
                expires_at: expiresAt
            };
        });
    }

    private mapReservation(row: any): StockReservation {
        return {
            reservation_id: row.reservation_id,
            tenant_id: row.tenant_id,
            session_id: row.session_id,
            user_id: row.user_id,
            demand_id: row.demand_id,
            demand_line_id: row.demand_line_id,
            product_id: row.product_id,
            lot: row.lot,
            expiry: row.expiry,
            location_id: row.location_id,
            qty_units: row.qty_units,
            status: row.status,
            expires_at: row.expires_at
        };
    }

    /**
     * 2. RELEASE SESSION - Cancel all active reservations for a session
     * 
     * RULES:
     * - Only updates stock_reservations status
     * - NEVER modifies current_stock
     * - Idempotent (safe to call twice)
     */
    async releaseSession(tenantId: string, sessionId: string): Promise<number> {
        const result = await tenantQuery(tenantId, `
            UPDATE stock_reservations 
            SET status = 'RELEASED', released_at = NOW() 
            WHERE session_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
        `, [sessionId, tenantId]);
        return result.length; // rowCount approximation
    }

    /**
     * 2b. RELEASE single reservation
     */
    async release(tenantId: string, reservationId: string): Promise<void> {
        await tenantQuery(tenantId, `
            UPDATE stock_reservations 
            SET status = 'RELEASED', released_at = NOW() 
            WHERE reservation_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
        `, [reservationId, tenantId]);
    }

    /**
     * 3. REFRESH SESSION - Extend expiry of active reservations
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
     * 4. GET SESSION CART
     */
    async getSessionCart(tenantId: string, sessionId: string): Promise<StockReservation[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT * FROM stock_reservations 
            WHERE session_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()
            ORDER BY product_id, lot
        `, [sessionId, tenantId]);
        return rows.map(r => this.mapReservation(r));
    }

    /**
     * 5. COMMIT SESSION - The Atomic Posting Contract
     * 
     * CRITICAL: This is a SINGLE ATOMIC TRANSACTION that:
     * a) Lock all ACTIVE reservations for the session (FOR UPDATE)
     * b) For each reservation:
     *    - GUARDED DECREMENT source stock (WHERE qty_units >= $take)
     *    - INCREMENT destination stock (upsert)
     * c) Insert inventory_movements for each lot/expiry
     * d) Create stock_transfers header + stock_transfer_lines
     * e) Mark reservations as COMMITTED with transfer_id link
     * f) Enforce invariants before commit
     * 
     * LOCK ORDER (mandatory to prevent deadlocks):
     * 1) stock_reservations (FOR UPDATE)
     * 2) current_stock (FOR UPDATE, sorted by location_id, product_id, lot)
     * 3) stock_transfers INSERT
     * 4) stock_transfer_lines INSERT
     * 5) inventory_movements INSERT
     */
    async commitSession(
        tenantId: string, 
        sessionId: string, 
        demandId: string, 
        userId: string,
        clientRequestId?: string
    ): Promise<string | null> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Idempotency: Check if this request was already processed
            if (clientRequestId) {
                const existing = await client.query(
                    `SELECT id FROM stock_transfers WHERE tenant_id = $1 AND client_request_id = $2`,
                    [tenantId, clientRequestId]
                );
                if (existing.rows.length > 0) {
                    return existing.rows[0].id;
                }
            }

            // STEP 1: Lock all ACTIVE reservations for this session (FOR UPDATE)
            const reservations = await client.query(`
                SELECT * FROM stock_reservations 
                WHERE session_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' AND expires_at > NOW()
                ORDER BY location_id, product_id, lot, expiry
                FOR UPDATE
            `, [sessionId, tenantId]);

            if (reservations.rows.length === 0) {
                return null; // Nothing to commit
            }

            // Fetch demand info for destination
            const demandResult = await client.query(
                `SELECT * FROM stock_demands WHERE id = $1`,
                [demandId]
            );
            if (demandResult.rows.length === 0) {
                throw new Error(`Demand ${demandId} not found`);
            }
            const demand = demandResult.rows[0];

            // Get default destination location for service
            const serviceLocResult = await client.query(
                `SELECT location_id as id FROM locations WHERE service_id = $1 AND status = 'ACTIVE' LIMIT 1`,
                [demand.service_id]
            );
            const headerDestId = serviceLocResult.rows.length > 0 
                ? serviceLocResult.rows[0].id 
                : 'UNKNOWN';

            // Source location (should be uniform for a session)
            const sourceLocId = reservations.rows[0].location_id;

            // STEP 2: Lock all source current_stock rows (FOR UPDATE, sorted)
            // Build list of unique (location, product, lot, expiry) combos - full row identity
            const stockKeys = reservations.rows.map(r => ({
                location: r.location_id,
                product: r.product_id,
                lot: r.lot,
                expiry: r.expiry
            }));

            // Lock source stock rows in deterministic order (full row identity)
            for (const key of stockKeys) {
                await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND location = $2 AND product_id = $3 AND lot = $4 AND expiry = $5
                    FOR UPDATE
                `, [tenantId, key.location, key.product, key.lot, key.expiry]);
            }

            // STEP 3: Create stock_transfers header
            const transferId = uuidv4();
            await client.query(`
                INSERT INTO stock_transfers (
                    id, tenant_id, demand_id, source_location_id, destination_location_id, 
                    status, validated_at, validated_by, client_request_id
                ) VALUES ($1, $2, $3, $4, $5, 'VALIDATED', NOW(), $6, $7)
            `, [transferId, tenantId, demandId, sourceLocId, headerDestId, userId, clientRequestId || null]);

            // STEP 4: Process each reservation
            for (const res of reservations.rows) {
                const take = res.qty_units;
                const destId = res.destination_location_id || headerDestId;

                // 4a. GUARDED ATOMIC DECREMENT source stock
                const decrementResult = await client.query(`
                    UPDATE current_stock
                    SET qty_units = qty_units - $1
                    WHERE tenant_id = $2
                      AND location = $3
                      AND product_id = $4
                      AND lot = $5
                      AND qty_units >= $1
                    RETURNING qty_units
                `, [take, tenantId, res.location_id, res.product_id, res.lot]);

                if (decrementResult.rowCount === 0) {
                    throw new Error(`STALE_RESERVATION: Cannot commit - stock insufficient for product ${res.product_id}, lot ${res.lot}. Reservation may be stale.`);
                }

                // 4b. INCREMENT destination stock (atomic upsert)
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, res.product_id, res.lot, res.expiry, destId, take]);

                // 4c. Insert inventory_movement (single movement, no document_type per user feedback)
                const moveId = uuidv4();
                await client.query(`
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units, 
                        from_location, to_location, document_id, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [moveId, tenantId, res.product_id, res.lot, res.expiry, take, 
                    res.location_id, destId, transferId, userId]);

                // 4d. Create stock_transfer_line (NULL for demand_line_id to avoid FK if not valid)
                const lineId = uuidv4();
                
                await client.query(`
                    INSERT INTO stock_transfer_lines (
                        id, tenant_id, transfer_id, product_id, lot, expiry, 
                        qty_transferred, source_location_id, destination_location_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [lineId, tenantId, transferId, res.product_id, res.lot, res.expiry, 
                    take, res.location_id, destId]);

                // 4e. Mark reservation as COMMITTED
                await client.query(`
                    UPDATE stock_reservations 
                    SET status = 'COMMITTED', committed_at = NOW(), transfer_id = $1, transfer_line_id = $2
                    WHERE reservation_id = $3
                `, [transferId, lineId, res.reservation_id]);
            }

            // STEP 5: Update demand status
            await client.query(`
                UPDATE stock_demands 
                SET status = 'PARTIALLY_FILLED', updated_at = NOW() 
                WHERE id = $1 AND status NOT IN ('FILLED', 'CANCELLED')
            `, [demandId]);

            // STEP 6: Final invariant check (optional but recommended)
            const negativeCheck = await client.query(`
                SELECT COUNT(*) as cnt FROM current_stock WHERE tenant_id = $1 AND qty_units < 0
            `, [tenantId]);
            if (parseInt(negativeCheck.rows[0].cnt) > 0) {
                throw new Error(`INVARIANT_VIOLATION: Negative stock detected after commit. Rolling back.`);
            }

            return transferId;
        });
    }

    /**
     * Expire old reservations (housekeeping job)
     */
    async expireStaleReservations(tenantId: string): Promise<number> {
        const result = await tenantQuery(tenantId, `
            UPDATE stock_reservations 
            SET status = 'EXPIRED' 
            WHERE tenant_id = $1 AND status = 'ACTIVE' AND expires_at < NOW()
        `, [tenantId]);
        return result.length;
    }
}

export const stockReservationService = new StockReservationService();
