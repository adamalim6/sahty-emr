/**
 * Stock Transfer Service - PostgreSQL Version
 * Manages stock demands (intent) and transfers (execution) between locations
 */

import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { v4 as uuidv4 } from 'uuid';

export interface StockDemand {
    id: string; // id in DB
    tenant_id: string;
    service_id: string;
    status: 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
    priority: 'ROUTINE' | 'URGENT';
    requested_by?: string;
    created_at?: string;
    items?: StockDemandLine[];
}

export interface StockDemandLine {
    demand_id: string;
    product_id: string;
    qty_requested: number;
    target_stock_location_id?: string; // Business intent: where requester wants stock to go
    target_location_code?: string;     // Resolved location code for display
    target_location_name?: string;     // Resolved location name for display
}

export interface StockTransfer {
    id: string;
    tenant_id: string;
    demand_id?: string;
    // Locations moved to lines
    status: 'PENDING' | 'VALIDATED' | 'COMPLETED';
    validated_at?: string;
    validated_by?: string;
    created_at?: string;
    items?: StockTransferLine[];
}

export interface StockTransferLine {
    id: string;
    transfer_id: string;
    product_id: string;
    lot: string;
    expiry: string;
    qty_transferred: number;
    demand_line_id?: string;
    source_location_id: string;
    destination_location_id: string;
}

class StockTransferService {

    // --- DEMAND (INTENT) LAYER ---

    async createDemand(tenantId: string, demand: Omit<StockDemand, 'id' | 'status' | 'created_at'>): Promise<string> {
        const demandId = uuidv4();
        // Generate Human Friendly Reference: DEM-YYYYMMDD-XXXX
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
        const demandRef = `DEM-${dateStr}-${randomStr}`;

        await tenantTransaction(tenantId, async (client) => {
            await client.query(`
                INSERT INTO stock_demands (id, tenant_id, service_id, status, priority, requested_by, demand_ref)
                VALUES ($1, $2, $3, 'SUBMITTED', $4, $5, $6)
            `, [demandId, tenantId, demand.service_id, demand.priority || 'ROUTINE', demand.requested_by, demandRef]);

            if (demand.items) {
                for (const item of demand.items) {
                    await client.query(`
                        INSERT INTO stock_demand_lines (demand_id, tenant_id, product_id, qty_requested, target_stock_location_id)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [demandId, tenantId, item.product_id, item.qty_requested, item.target_stock_location_id || null]);
                }
            }
        });

        return demandId;
    }

    async getDemands(tenantId: string, serviceId?: string): Promise<StockDemand[]> {
        // Updated to JOIN services for name and include demand_ref
        let sql = `
            SELECT d.*, s.name as service_name 
            FROM stock_demands d
            LEFT JOIN services s ON d.service_id = s.id
            WHERE d.tenant_id = $1
        `;
        const params: any[] = [tenantId];

        if (serviceId) {
            sql += ` AND d.service_id = $2`;
            params.push(serviceId);
        }
        
        sql += ` ORDER BY d.created_at DESC`;

        const rows = await tenantQuery(tenantId, sql, params);
        
        return rows.map(r => ({
            id: r.id,
            tenant_id: r.tenant_id,
            service_id: r.service_id,
            service_name: r.service_name, // Mapped field
            demand_ref: r.demand_ref,     // Mapped field
            status: r.status,
            priority: r.priority,
            requested_by: r.requested_by,
            created_at: r.created_at
        }));
    }

    async getDemandDetails(tenantId: string, demandId: string): Promise<StockDemand | null> {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM stock_demands WHERE id = $1 AND tenant_id = $2`, 
            [demandId, tenantId]
        );
        
        if (rows.length === 0) return null;
        const row = rows[0];

        // JOIN with locations to get target location name/code
        const items = await tenantQuery(tenantId, 
            `SELECT sdl.*, l.location_id as target_location_code, l.name as target_location_name
             FROM stock_demand_lines sdl
             LEFT JOIN locations l ON sdl.target_stock_location_id = l.location_id
             WHERE sdl.demand_id = $1`, 
            [demandId]
        );

        return {
            id: row.id,
            tenant_id: row.tenant_id,
            service_id: row.service_id,
            status: row.status,
            priority: row.priority,
            requested_by: row.requested_by,
            created_at: row.created_at,
            items: items.map(i => ({
            id: i.id,  // Critical: The demand line's own ID for FK references
            demand_id: i.demand_id,
            product_id: i.product_id,
            qty_requested: i.qty_requested,
            target_stock_location_id: i.target_stock_location_id,
            target_location_code: i.target_location_code,
            target_location_name: i.target_location_name
            }))
        };
    }

    async updateDemandStatus(tenantId: string, demandId: string, status: string) {
        await tenantQuery(tenantId, 
            `UPDATE stock_demands SET status = $1 WHERE id = $2 AND tenant_id = $3`, 
            [status, demandId, tenantId]
        );
    }

    /**
     * CONCURRENCY CONTROL: Claim a demand for processing
     * Returns true if claimed successfully or already owned by user.
     * Throws error with details if owned by someone else.
     */
    async claimDemand(tenantId: string, demandId: string, userId: string): Promise<void> {
        return tenantTransaction(tenantId, async (client) => {
            // Join users to get name of claimer (columns are nom/prenom, not first_name/last_name)
            const res = await client.query(`
                SELECT sd.processing_status, sd.assigned_user_id, sd.claimed_at, u.username, u.nom, u.prenom
                FROM stock_demands sd
                LEFT JOIN users u ON u.id = sd.assigned_user_id
                WHERE sd.id = $1::uuid AND sd.tenant_id = $2::uuid
                FOR UPDATE OF sd
            `, [demandId, tenantId]);

            if (res.rows.length === 0) throw new Error('Demand not found');
            const row = res.rows[0];
            const { processing_status, assigned_user_id, claimed_at } = row;

            console.log(`[ClaimDebug] Demand ${demandId}: Status=${processing_status}, Assigned=${assigned_user_id}, RequestingUser=${userId}`);

            if (processing_status === 'IN_PROGRESS') {
                if (assigned_user_id !== userId) {
                    console.warn(`[ClaimDebug] CONFLICT! Assigned=${assigned_user_id} !== Requesting=${userId}`);
                    // Resolve display name using nom/prenom
                    const name = row.prenom ? `${row.prenom} ${row.nom || ''}`.trim() : (row.username || 'Utilisateur inconnu');
                    
                    const error: any = new Error(`Demand is already being processed by ${name}`);
                    error.code = 'DEMAND_LOCKED';
                    error.details = {
                        claimedBy: name,
                        claimedAt: claimed_at
                    };
                    throw error;
                }
                // Already ours, good.
                return;
            }

            // Otherwise claim it
            await client.query(`
                UPDATE stock_demands 
                SET processing_status = 'IN_PROGRESS', assigned_user_id = $1::uuid, claimed_at = NOW()
                WHERE id = $2::uuid
            `, [userId, demandId]);
        });
    }

    /**
     * Release a claim (e.g. if user cancels or leaves page properly)
     */
    async releaseDemandClaim(tenantId: string, demandId: string, userId: string): Promise<void> {
        await tenantQuery(tenantId, `
            UPDATE stock_demands 
            SET processing_status = 'OPEN', assigned_user_id = NULL, claimed_at = NULL
            WHERE id = $1::uuid AND tenant_id = $2::uuid AND assigned_user_id = $3::uuid
        `, [demandId, tenantId, userId]);
    }

    /**
     * Fulfills a Stock Demand by creating a Transfer and moving stock.
     * STRICT 7-STEP ATOMIC TRANSACTION
     */
    async fulfillDemand(tenantId: string, demandId: string, transferData: { 
        userId: string, 
        lines: { 
            productId: string, 
            qty: number, 
            lot: string, 
            expiry: string,
            reservationId?: string 
        }[] 
    }): Promise<string> {
        const transferId = uuidv4();

        return tenantTransaction(tenantId, async (client) => {
            // ✅ Step 1 — Lock Everything (Anti-Race Condition)
            // Resolve Pharmacy Location (Source)
            const pharmLocRes = await client.query(`SELECT location_id FROM locations WHERE scope = 'PHARMACY' LIMIT 1`);
            const pharmacyLocationId = pharmLocRes.rows[0]?.location_id;
            if (!pharmacyLocationId) throw new Error("No PHARMACY location found");

            // Lock Demand
            await client.query(`SELECT id FROM stock_demands WHERE id = $1 FOR UPDATE`, [demandId]);
            
            // Lock Stock Rows involved (and verify existence)
            for (const line of transferData.lines) {
                // We lock the specific lot/location row we are pulling from
                await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location_id = $4
                    FOR UPDATE
                `, [tenantId, line.productId, line.lot, pharmacyLocationId]);
            }

            // ✅ Step 2 — Validate Availability & Reservations
            for (const line of transferData.lines) {
                // 2a. Get Physical Stock
                const stockRes = await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location_id = $4
                `, [tenantId, line.productId, line.lot, pharmacyLocationId]);
                const currentQty = stockRes.rows[0]?.qty_units || 0;

                // 2b. Get Active Reservations (excluding current user/session if needed, but usually we validate against ALL others)
                // If a reservationId is passed, it means WE hold that reservation, so we exclude it from the "blocked" count.
                // Otherwise, we must assume all active reservations block stock.
                let queryRes = `
                    SELECT SUM(l.qty_units) as reserved
                    FROM stock_reservation_lines l
                    JOIN stock_reservations r ON l.reservation_id = r.reservation_id
                    WHERE r.tenant_id = $1 
                      AND l.product_id = $2 AND l.lot = $3 AND l.source_location_id = $4
                      AND r.status = 'ACTIVE'
                      AND r.expires_at > NOW()
                `;
                const paramsRes: any[] = [tenantId, line.productId, line.lot, pharmacyLocationId];

                if (line.reservationId) {
                    queryRes += ` AND r.reservation_id != $4`;
                    paramsRes.push(line.reservationId);
                }

                const resResult = await client.query(queryRes, paramsRes);
                const reservedQty = Number(resResult.rows[0]?.reserved) || 0;

                // 2c. Check Availability
                const available = currentQty - reservedQty;
                if (available < line.qty) {
                    throw new Error(`Stock unavailable for ${line.productId} Lot ${line.lot}. Current: ${currentQty}, Reserved: ${reservedQty}, Requested: ${line.qty}`);
                }
            }

            // ✅ Step 3 — Create stock_transfers header (Business Context)
            // Read target locations from demand lines to determine destination
            const demandRes = await client.query(`SELECT service_id, demand_ref FROM stock_demands WHERE id = $1`, [demandId]);
            const demand = demandRes.rows[0];
            
            // Get the first demand line's target_stock_location_id as the primary destination
            // For now, we assume all lines in one fulfillment go to the same destination
            // (Per-line destination transfers would require multiple stock_transfers records)
            const demandLinesRes = await client.query(
                `SELECT target_stock_location_id FROM stock_demand_lines WHERE demand_id = $1 LIMIT 1`, 
                [demandId]
            );
            // Use target_stock_location_id if set, otherwise fallback to service_id
            const destLocationId = demandLinesRes.rows[0]?.target_stock_location_id || demand.service_id;

            await client.query(`
                INSERT INTO stock_transfers (id, tenant_id, demand_id, status, validated_at, validated_by)
                VALUES ($1, $2, $3, 'COMPLETED', NOW(), $4)
            `, [transferId, tenantId, demandId, transferData.userId]);

            // ✅ Step 4 — Update current_stock (Physical Truth)
            for (const line of transferData.lines) {
                // Decrement Source (Pharmacy)
                await client.query(`
                    UPDATE current_stock 
                    SET qty_units = qty_units - $1 
                    WHERE tenant_id = $2 AND product_id = $3 AND lot = $4 AND location_id = $5
                `, [line.qty, tenantId, line.productId, line.lot, pharmacyLocationId]);

                // Increment Destination (Service) - UPSERT
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location_id) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, line.productId, line.lot, line.expiry, destLocationId, line.qty]);
            }

            // ✅ Step 5 — Write stock_transfer_lines (Business Detail)
            for (const line of transferData.lines) {
                const lineId = uuidv4();
                // We need to find the demand_line_id for this product.
                // NOTE: Checks strict linkage. If multiple lines for same product, this might be ambiguous.
                // Simplification -> pick the first matching demand line that isn't fully filled?
                // Or user doesn't pass demand_line_id? The previous `items` struct didn't have it.
                // Let's lookup demand_line_id dynamically or nullable.
                const demandLineRes = await client.query(`
                    SELECT demand_line_id FROM stock_demand_lines 
                    WHERE demand_id = $1 AND product_id = $2 
                    LIMIT 1
                `, [demandId, line.productId]);
                const demandLineId = demandLineRes.rows[0]?.demand_line_id;

                await client.query(`
                    INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id, source_location_id, destination_location_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [lineId, tenantId, transferId, line.productId, line.lot, line.expiry, line.qty, demandLineId, pharmacyLocationId, destLocationId]);
                
                // Update Demand Line Delivered Qty (Optional but good for tracking)
                 if (demandLineId) {
                    /* Not in strict 7-steps but needed for progress tracking */
                 }
            }

            // ✅ Step 6 — Write inventory_movements (Ledger)
            for (const line of transferData.lines) {
                const moveId = uuidv4();
                await client.query(`
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location_id, to_location_id, document_type, document_id, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TRANSFER', $9, $10)
                `, [moveId, tenantId, line.productId, line.lot, line.expiry, line.qty, pharmacyLocationId, destLocationId, transferId, transferData.userId]);
            }

            // ✅ Step 7 — Commit Reservations (Logical Truth) & Update Demand Status
            for (const line of transferData.lines) {
                if (line.reservationId) {
                    await client.query(`
                        UPDATE stock_reservations 
                        SET status = 'AGE_MOVED', transfer_id = $1, committed_at = NOW()
                        WHERE reservation_id = $2
                    `, [transferId, line.reservationId]);
                }
            }
            // Update Demand Status to partially filled or filled?
            // Simplified: Just set to FILLED for now as requested by user flow usually implies full processing.
            // Or check if fully satisfied. For atomic safety, let's look if we want to update it.
            // User requested: "Update stock_demands status to FILLED"
            await client.query(`UPDATE stock_demands SET status = 'FILLED' WHERE id = $1`, [demandId]);

            return transferId;
        });
    }

    // --- TRANSFER (EXECUTION) LAYER ---


    async createTransferDraft(tenantId: string, transfer: Omit<StockTransfer, 'id' | 'status' | 'created_at'>): Promise<string> {
        const transferId = uuidv4();

        await tenantTransaction(tenantId, async (client) => {
            await client.query(`
                INSERT INTO stock_transfers (id, tenant_id, demand_id, status)
                VALUES ($1, $2, $3, 'PENDING')
            `, [transferId, tenantId, transfer.demand_id]);

            if (transfer.items) {
                for (const item of transfer.items) {
                    const lineId = uuidv4();
                    await client.query(`
                        INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id, source_location_id, destination_location_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [lineId, tenantId, transferId, item.product_id, item.lot, item.expiry, item.qty_transferred, item.demand_line_id, item.source_location_id, item.destination_location_id]);
                }
            }
        });

        return transferId;
    }

    async getTransferDetails(tenantId: string, transferId: string): Promise<StockTransfer | null> {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM stock_transfers WHERE id = $1 AND tenant_id = $2`, 
            [transferId, tenantId]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        
        const lines = await tenantQuery(tenantId, 
            `SELECT * FROM stock_transfer_lines WHERE transfer_id = $1`, 
            [transferId]
        );
        
        return {
            id: row.id,
            tenant_id: row.tenant_id,
            demand_id: row.demand_id,
            status: row.status,
            items: lines.map(l => ({
                id: l.id,
                transfer_id: l.transfer_id,
                product_id: l.product_id,
                lot: l.lot,
                expiry: l.expiry,
                qty_transferred: l.qty_transferred,
                demand_line_id: l.demand_line_id,
                source_location_id: l.source_location_id,
                destination_location_id: l.destination_location_id
            }))
        };
    }

    async executeTransfer(tenantId: string, transferId: string, userId: string) {
        await tenantTransaction(tenantId, async (client) => {
            // 1. Get Transfer
            const transferResult = await client.query(
                `SELECT * FROM stock_transfers WHERE id = $1 AND tenant_id = $2`, 
                [transferId, tenantId]
            );
            if (transferResult.rows.length === 0) throw new Error('Transfer not found');
            const transfer = transferResult.rows[0];
            if (transfer.status === 'COMPLETED') throw new Error('Transfer already completed');

            const linesResult = await client.query(
                `SELECT * FROM stock_transfer_lines WHERE transfer_id = $1`, 
                [transferId]
            );
            const lines = linesResult.rows;

            for (const line of lines) {
                // Verify Stock
                const stockResult = await client.query(
                    `SELECT qty_units FROM current_stock WHERE tenant_id = $1 AND location = $2 AND product_id = $3 AND lot = $4`, 
                    [tenantId, transfer.source_location_id, line.product_id, line.lot]
                );
                const stock = stockResult.rows[0];
                
                if (!stock || stock.qty_units < line.qty_transferred) {
                    throw new Error(`Insufficient stock for product ${line.product_id} lot ${line.lot}`);
                }

                // Decrement Source
                await client.query(
                    `UPDATE current_stock SET qty_units = qty_units - $1 WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5`,
                    [line.qty_transferred, tenantId, line.source_location_id, line.product_id, line.lot]
                );

                // Increment Destination
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location_id) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, line.product_id, line.lot, line.expiry, line.destination_location_id, line.qty_transferred]);

                // Log Movement
                const moveId = uuidv4();
                await client.query(`
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location_id, to_location_id, document_type, document_id, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TRANSFER', $9, $10)
                `, [moveId, tenantId, line.product_id, line.lot, line.expiry, line.qty_transferred, line.source_location_id, line.destination_location_id, transferId, userId]);
            }

            // 3. Complete Transfer
            await client.query(
                `UPDATE stock_transfers SET status = 'COMPLETED', validated_at = CURRENT_TIMESTAMP, validated_by = $1 WHERE id = $2`, 
                [userId, transferId]
            );

            // 4. Update Linked Demand
            if (transfer.demand_id) {
                await client.query(
                    `UPDATE stock_demands SET status = 'FILLED' WHERE id = $1`, 
                    [transfer.demand_id]
                );
            }
        });
    }

    async getTransferHistory(tenantId: string, productId: string): Promise<any[]> {
        const sql = `
            SELECT 
                stl.qty_transferred,
                stl.lot,
                st.validated_at as date,
                st.id as transfer_id,
                st.status
            FROM stock_transfer_lines stl
            JOIN stock_transfers st ON st.id = stl.transfer_id
            WHERE st.tenant_id = $1 
            AND stl.product_id = $2
            AND st.status = 'COMPLETED'
            ORDER BY st.validated_at DESC
            LIMIT 5
        `;
        
        return tenantQuery(tenantId, sql, [tenantId, productId]);
    }
}

export const stockTransferService = new StockTransferService();
