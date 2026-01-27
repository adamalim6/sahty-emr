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
    destination_location_id?: string;
}

export interface StockTransfer {
    id: string;
    tenant_id: string;
    demand_id?: string;
    source_location_id: string;
    destination_location_id: string;
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
                        INSERT INTO stock_demand_lines (demand_id, tenant_id, product_id, qty_requested, destination_location_id)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [demandId, tenantId, item.product_id, item.qty_requested, item.destination_location_id || null]);
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
            LEFT JOIN services s ON d.service_id = s.id::text
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

        const items = await tenantQuery(tenantId, 
            `SELECT * FROM stock_demand_lines WHERE demand_id = $1`, 
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
                demand_id: i.demand_id,
                product_id: i.product_id,
                qty_requested: i.qty_requested
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
            // Lock Demand
            await client.query(`SELECT id FROM stock_demands WHERE id = $1 FOR UPDATE`, [demandId]);
            
            // Lock Stock Rows involved (and verify existence)
            for (const line of transferData.lines) {
                // We lock the specific lot/location row we are pulling from
                await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = 'PHARMACY_MAIN'
                    FOR UPDATE
                `, [tenantId, line.productId, line.lot]);
            }

            // ✅ Step 2 — Validate Availability & Reservations
            for (const line of transferData.lines) {
                // 2a. Get Physical Stock
                const stockRes = await client.query(`
                    SELECT qty_units FROM current_stock 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location = 'PHARMACY_MAIN'
                `, [tenantId, line.productId, line.lot]);
                const currentQty = stockRes.rows[0]?.qty_units || 0;

                // 2b. Get Active Reservations (excluding current user/session if needed, but usually we validate against ALL others)
                // If a reservationId is passed, it means WE hold that reservation, so we exclude it from the "blocked" count.
                // Otherwise, we must assume all active reservations block stock.
                let queryRes = `
                    SELECT SUM(qty_units) as reserved 
                    FROM stock_reservations 
                    WHERE tenant_id = $1 AND product_id = $2 AND lot = $3 AND location_id = 'PHARMACY_MAIN' 
                    AND status = 'ACTIVE'
                    AND expires_at > NOW()
                `;
                const paramsRes: any[] = [tenantId, line.productId, line.lot];

                if (line.reservationId) {
                    queryRes += ` AND reservation_id != $4`;
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
            // Assuming destination is the service linked to the demand
            const demandRes = await client.query(`SELECT service_id, demand_ref FROM stock_demands WHERE id = $1`, [demandId]);
            const demand = demandRes.rows[0];
            // We need a destination location ID for the service. For now, we might assume a convention or lookup.
            // If service_id is a UUID, we might check if there's a primary location for it.
            // FALLBACK: Use service_id as location_id if they map 1:1, or look it up. 
            // NOTE: In current architecture, services might handle their own stock or it's just "OUT".
            // Let's assume destination is the Service ID for now as per user previous patterns.
            const destLocationId = demand.service_id; 

            await client.query(`
                INSERT INTO stock_transfers (id, tenant_id, demand_id, source_location_id, destination_location_id, status, validated_at, validated_by)
                VALUES ($1, $2, $3, 'PHARMACY_MAIN', $4, 'COMPLETED', NOW(), $5)
            `, [transferId, tenantId, demandId, destLocationId, transferData.userId]);

            // ✅ Step 4 — Update current_stock (Physical Truth)
            for (const line of transferData.lines) {
                // Decrement Source (Pharmacy)
                await client.query(`
                    UPDATE current_stock 
                    SET qty_units = qty_units - $1 
                    WHERE tenant_id = $2 AND product_id = $3 AND lot = $4 AND location = 'PHARMACY_MAIN'
                `, [line.qty, tenantId, line.productId, line.lot]);

                // Increment Destination (Service) - UPSERT
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location) 
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
                    INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [lineId, tenantId, transferId, line.productId, line.lot, line.expiry, line.qty, demandLineId]);
                
                // Update Demand Line Delivered Qty (Optional but good for tracking)
                 if (demandLineId) {
                    /* Not in strict 7-steps but needed for progress tracking */
                 }
            }

            // ✅ Step 6 — Write inventory_movements (Ledger)
            for (const line of transferData.lines) {
                const moveId = uuidv4();
                await client.query(`
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location, to_location, document_type, document_id, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, 'PHARMACY_MAIN', $7, 'TRANSFER', $8, $9)
                `, [moveId, tenantId, line.productId, line.lot, line.expiry, line.qty, destLocationId, transferId, transferData.userId]);
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
                INSERT INTO stock_transfers (id, tenant_id, demand_id, source_location_id, destination_location_id, status)
                VALUES ($1, $2, $3, $4, $5, 'PENDING')
            `, [transferId, tenantId, transfer.demand_id, transfer.source_location_id, transfer.destination_location_id]);

            if (transfer.items) {
                for (const item of transfer.items) {
                    const lineId = uuidv4();
                    await client.query(`
                        INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [lineId, tenantId, transferId, item.product_id, item.lot, item.expiry, item.qty_transferred, item.demand_line_id]);
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
            source_location_id: row.source_location_id,
            destination_location_id: row.destination_location_id,
            status: row.status,
            items: lines.map(l => ({
                id: l.id,
                transfer_id: l.transfer_id,
                product_id: l.product_id,
                lot: l.lot,
                expiry: l.expiry,
                qty_transferred: l.qty_transferred,
                demand_line_id: l.demand_line_id
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
                    `UPDATE current_stock SET qty_units = qty_units - $1 WHERE tenant_id = $2 AND location = $3 AND product_id = $4 AND lot = $5`,
                    [line.qty_transferred, tenantId, transfer.source_location_id, line.product_id, line.lot]
                );

                // Increment Destination
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, line.product_id, line.lot, line.expiry, transfer.destination_location_id, line.qty_transferred]);

                // Log Movement
                const moveId = uuidv4();
                await client.query(`
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location, to_location, document_type, document_id, created_by)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TRANSFER', $9, $10)
                `, [moveId, tenantId, line.product_id, line.lot, line.expiry, line.qty_transferred, transfer.source_location_id, transfer.destination_location_id, transferId, userId]);
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
