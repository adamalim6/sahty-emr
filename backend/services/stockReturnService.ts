
/**
 * Stock Return Service
 * Manages the lifecycle of Stock Returns (Retours Service -> Pharmacie)
 * 
 * WORKFLOW:
 * 1. Draft: Reservations created via stockReservationService (Basket).
 * 2. Commit: Reservations converted to stock_returns + stock_return_lines.
 * 3. Stock Effect: 
 *    - Reserved units DECREASED.
 *    - Pending Return units INCREASED.
 *    - Physical Qty UNCHANGED (until reception).
 */

import { v4 as uuidv4 } from 'uuid';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

export interface StockReturn {
    id: string;
    tenant_id: string;
    return_reference: string;
    service_id: string;
    created_by: string;
    status: 'CREATED' | 'PARTIALLY_RECEIVED' | 'CLOSED' | 'CANCELLED';
    created_at: string;
    lines?: StockReturnLine[];
}

export interface StockReturnLine {
    id: string;
    return_id: string;
    product_id: string;
    lot: string;
    expiry: string;
    qty_declared_units: number;
    source_location_id: string;
    destination_location_id?: string;
}

class StockReturnService {

    /**
     * Create a Stock Return from a single active reservation (Atomic Transaction).
     * Ref: User Request - Step 4498
     */
    async createReturn(
        tenantId: string, 
        userId: string, 
        serviceId: string,
        reservationId: string
    ): Promise<string> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Validate Reservation State
            const resHeader = await client.query(`
                SELECT * FROM stock_reservations 
                WHERE reservation_id = $1 AND tenant_id = $2
                FOR UPDATE
            `, [reservationId, tenantId]);

            if (resHeader.rows.length === 0) throw new Error(`Reservation ${reservationId} not found`);
            if (resHeader.rows[0].status !== 'ACTIVE') throw new Error(`Reservation ${reservationId} is not ACTIVE (Status: ${resHeader.rows[0].status})`);

            // 1.5 Enforce Destination Location (RETURN_QUARANTINE) - System Policy
            const quarantineRes = await client.query(`SELECT location_id FROM locations WHERE tenant_id = $1 AND name = 'RETURN_QUARANTINE' AND status = 'ACTIVE' LIMIT 1`, [tenantId]);
            if (quarantineRes.rows.length === 0) throw new Error("RETURN_QUARANTINE location not found");
            const quarantineId = quarantineRes.rows[0].location_id;

            await client.query(`UPDATE stock_reservation_lines SET destination_location_id = $1 WHERE reservation_id = $2`, [quarantineId, reservationId]);

            // Check if it has lines
            const linesRes = await client.query(`
                SELECT * FROM stock_reservation_lines 
                WHERE reservation_id = $1
                ORDER BY product_id, lot
                FOR UPDATE
            `, [reservationId]);
            
            if (linesRes.rows.length === 0) {
                throw new Error("Reservation has no lines");
            }

            const lines = linesRes.rows;

            // 2. Create Header (stock_returns)
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
            const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
            const returnRef = `RET-${dateStr}-${randomStr}`;
            const returnId = uuidv4();

            await client.query(`
                INSERT INTO stock_returns (
                    id, tenant_id, return_reference, source_service_id, created_by, status, created_at, 
                    stock_reservation_id, source_type
                ) VALUES ($1, $2, $3, $4, $5, 'SUBMITTED', NOW(), $6, 'SERVICE')
            `, [returnId, tenantId, returnRef, serviceId, userId, reservationId]);

            // 3. Process Each Line (stock_return_lines + Stock Effect)
            for (const line of lines) {
                const returnLineId = uuidv4();
                
                // 3a. Create Return Line
                await client.query(`
                    INSERT INTO stock_return_lines (
                        id, return_id, product_id, lot, expiry, qty_declared_units,
                        source_location_id, stock_reservation_line_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    returnLineId, 
                    returnId, 
                    line.product_id, 
                    line.lot, 
                    line.expiry, 
                    line.qty_units, // declared units
                    line.source_location_id,
                    line.id // lineage: stock_reservation_line_id
                ]);

                // 3b. Mutate Stock: Reserved -> Pending Return (Atomic Move)
                // "returned but not yet inspected"
                const updateRes = await client.query(`
                    UPDATE current_stock
                    SET reserved_units = GREATEST(0, COALESCE(reserved_units, 0) - $1),
                        pending_return_units = COALESCE(pending_return_units, 0) + $1
                    WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5
                `, [line.qty_units, tenantId, line.source_location_id, line.product_id, line.lot]);

                if (updateRes.rowCount === 0) {
                    throw new Error(`Failed to update stock for ${line.product_id} lot ${line.lot}. Stock row may be missing.`);
                }
            }

            // 4. Commit Reservation
            await client.query(`
                UPDATE stock_reservations
                SET status = 'COMMITTED', committed_at = NOW()
                WHERE reservation_id = $1
            `, [reservationId]);

            return returnId;
        });
    }

    /**
     * Get Returns History
     */
    async getReturns(tenantId: string, serviceId?: string, status?: string): Promise<any[]> {
        
        let sql = `
            SELECT 
                r.id, r.return_reference, r.created_at, r.status, r.created_by,
                s.name as service_name, r.source_service_id,
                u.username, u.nom, u.prenom
            FROM stock_returns r
            LEFT JOIN services s ON r.source_service_id = s.id
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.tenant_id = $1
        `;
        const params: any[] = [tenantId];
        let pIdx = 2; // Start param index

        if (serviceId) {
            sql += ` AND r.source_service_id = $${pIdx++}`;
            params.push(serviceId);
        }

        if (status) {
            sql += ` AND r.status = $${pIdx++}`;
            params.push(status);
        }

        sql += ` ORDER BY r.created_at DESC`;

        return tenantQuery(tenantId, sql, params);
    }

    /**
     * Create Return Reception (Atomic Transaction)
     * Ref: User Request - Step 4834
     */
    async createReception(
        tenantId: string,
        userId: string,
        returnId: string,
        lines: { returnLineId: string, qtyReceived: number }[]
    ): Promise<string> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Validate Return State
            const retHeader = await client.query(`
                SELECT * FROM stock_returns 
                WHERE id = $1 AND tenant_id = $2
                FOR UPDATE
            `, [returnId, tenantId]);

            if (retHeader.rows.length === 0) throw new Error(`Return ${returnId} not found`);
            const currentStatus = retHeader.rows[0].status;
            if (currentStatus !== 'SUBMITTED' && currentStatus !== 'PARTIALLY_RECEIVED') {
                throw new Error(`Return ${returnId} is not eligible for reception (Status: ${currentStatus})`);
            }

            // 2. Create Reception Header
            const receptionId = uuidv4();
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            const receptionRef = `RCP-${dateStr}-${randomSuffix}`;
            
            await client.query(`
                INSERT INTO return_receptions (id, return_id, received_by, received_at, reception_reference)
                VALUES ($1, $2, $3, NOW(), $4)
            `, [receptionId, returnId, userId, receptionRef]);

            let totalDeclared = 0;
            let totalReceived = 0;

            // 3. Process Lines
            for (const item of lines) {
                // Get Return Line + Destination (via Reservation Line)
                const lineRes = await client.query(`
                    SELECT rl.*, res.destination_location_id 
                    FROM stock_return_lines rl
                    JOIN stock_reservation_lines res ON rl.stock_reservation_line_id = res.id
                    WHERE rl.id = $1 AND rl.return_id = $2
                `, [item.returnLineId, returnId]);

                if (lineRes.rows.length === 0) throw new Error(`Return line ${item.returnLineId} not found`);
                const line = lineRes.rows[0];

                // Validate Quantity
                if (item.qtyReceived < 0 || item.qtyReceived > line.qty_declared_units) {
                    throw new Error(`Invalid quantity ${item.qtyReceived} for line ${line.id} (Declared: ${line.qty_declared_units})`);
                }

                totalDeclared += line.qty_declared_units;
                totalReceived += item.qtyReceived;

                // Insert Reception Line
                await client.query(`
                    INSERT INTO return_reception_lines (id, reception_id, return_line_id, qty_received_units)
                    VALUES ($1, $2, $3, $4)
                `, [uuidv4(), receptionId, item.returnLineId, item.qtyReceived]);

                if (item.qtyReceived > 0) {
                    // Resolve Destination
                    const destLocId = line.destination_location_id;
                    if (!destLocId) throw new Error(`Destination location missing for return line ${line.id}`);

                    // Inventory Movement
                    await client.query(`
                        INSERT INTO inventory_movements (
                            movement_id, tenant_id, product_id, lot, expiry, qty_units,
                            from_location_id, to_location_id, document_type, document_id, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RETURN_RECEPTION', $9, $10)
                    `, [
                        uuidv4(), tenantId, line.product_id, line.lot, line.expiry, item.qtyReceived,
                        line.source_location_id, destLocId, receptionId, userId
                    ]);

                    // Update Source Stock (Pending Return & Physical)
                    // Note: reserved_units is already released at return creation, not at reception
                    const sourceUpd = await client.query(`
                        UPDATE current_stock
                        SET pending_return_units = GREATEST(0, COALESCE(pending_return_units, 0) - $1),
                            qty_units = qty_units - $1
                        WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
                    `, [item.qtyReceived, tenantId, line.source_location_id, line.product_id, line.lot, line.expiry]);

                    if (sourceUpd.rowCount === 0) throw new Error(`Failed to update source stock for ${line.product_id} lot ${line.lot}`);

                    // Update Destination Stock (Physical)
                    await client.query(`
                        INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT(tenant_id, product_id, lot, location_id) 
                        DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                    `, [tenantId, line.product_id, line.lot, line.expiry, destLocId, item.qtyReceived]);
                }
            }

            // 4. Determine Return Status (based on ALL receptions, not just current)
            // Query total declared vs total received across ALL reception lines for this return
            const statusCheck = await client.query(`
                SELECT 
                    (SELECT COALESCE(SUM(qty_declared_units), 0) FROM stock_return_lines WHERE return_id = $1) as total_declared,
                    (SELECT COALESCE(SUM(rcl.qty_received_units), 0) 
                     FROM return_reception_lines rcl 
                     JOIN stock_return_lines srl ON rcl.return_line_id = srl.id 
                     WHERE srl.return_id = $1) as total_received
            `, [returnId]);
            
            const { total_declared, total_received } = statusCheck.rows[0];
            const finalStatus = (parseInt(total_received) < parseInt(total_declared)) ? 'PARTIALLY_RECEIVED' : 'CLOSED';
            
            await client.query(`
                UPDATE stock_returns 
                SET status = $1 
                WHERE id = $2
            `, [finalStatus, returnId]);

            return receptionId;
        });
    }

    /**
     * Get Single Reception Details
     */
    async getReceptionDetails(tenantId: string, receptionId: string): Promise<any> {
        const header = await tenantQuery(tenantId, `
            SELECT r.*, s.name as service_name, sr.return_reference
            FROM return_receptions r
            JOIN stock_returns sr ON r.return_id = sr.id
            LEFT JOIN services s ON sr.source_service_id = s.id
            WHERE r.id = $1
        `, [receptionId]);
        
        if (header.length === 0) return null;

        const lines = await tenantQuery(tenantId, `
            SELECT 
                rrl.id, rrl.qty_received_units, rrl.return_line_id,
                srl.product_id, srl.lot, srl.expiry,
                srl.qty_declared_units -- informative
            FROM return_reception_lines rrl
            JOIN stock_return_lines srl ON rrl.return_line_id = srl.id
            WHERE rrl.reception_id = $1
        `, [receptionId]);

        return { ...header[0], lines };
    }

    /**
     * Get Receptions for a Return
     */
    async getReceptionsByReturnId(tenantId: string, returnId: string): Promise<any[]> {
        const sql = `
            SELECT 
                r.id, r.reception_reference, r.received_at, r.status,
                u.username, u.nom, u.prenom,
                (SELECT SUM(line.qty_received_units) FROM return_reception_lines line WHERE line.reception_id = r.id) as total_received
            FROM return_receptions r
            LEFT JOIN users u ON r.received_by = u.id
            WHERE r.return_id = $1
            ORDER BY r.received_at DESC
        `;
        return tenantQuery(tenantId, sql, [returnId]);
    }

    /**
     * Create Return Decision (Atomic Transaction)
     */
    async createReturnDecision(
        tenantId: string,
        receptionId: string,
        userId: string,
        decisions: { returnLineId: string; qty: number; outcome: 'COMMERCIAL' | 'CHARITY' | 'WASTE'; destinationLocationId?: string }[]
    ): Promise<string> {
        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // 1. Verify Reception Status
            const recepRes = await client.query('SELECT status, return_id FROM return_receptions WHERE id = $1 FOR UPDATE', [receptionId]);
            if (recepRes.rows.length === 0) throw new Error('Reception not found');
            const reception = recepRes.rows[0];
            
            if (reception.status !== 'OPEN') {
                throw new Error(`Reception is not OPEN (Status: ${reception.status})`);
            }

            // 2. Load Reception Lines & Previous Decisions for Validation
            const linesRes = await client.query(`
                SELECT 
                    rl.id as return_line_id,
                    rrl.qty_received_units,
                    srl.product_id,
                    srl.lot,
                    srl.expiry,
                    rrl.id as reception_line_id
                FROM return_reception_lines rrl
                JOIN stock_return_lines srl ON rrl.return_line_id = srl.id
                JOIN return_receptions rr ON rrl.reception_id = rr.id
                JOIN stock_return_lines rl ON rrl.return_line_id = rl.id 
                WHERE rr.id = $1
            `, [receptionId]);

            const lineMap = new Map<string, any>();
            linesRes.rows.forEach((r: any) => lineMap.set(r.return_line_id, r));

            // Fetch prior decisions for this reception
            const priorDecisionsRes = await client.query(`
                SELECT return_line_id, SUM(qty_units) as total_decided
                FROM return_decision_lines rdl
                JOIN return_decisions rd ON rdl.decision_id = rd.id
                WHERE rd.reception_id = $1
                GROUP BY return_line_id
            `, [receptionId]);
            
            const priorDecisionsMap = new Map<string, number>();
            priorDecisionsRes.rows.forEach((r: any) => priorDecisionsMap.set(r.return_line_id, parseInt(r.total_decided)));

            // 3. Create Decision Header
            const decisionId = uuidv4();
            await client.query(`
                INSERT INTO return_decisions (id, reception_id, decided_by, decided_at)
                VALUES ($1, $2, $3, NOW())
            `, [decisionId, receptionId, userId]);

            // 4. Process Each Decision
            const quarantineLocId = (await this.getQuarantineLocation(tenantId, client))?.id;
            if (!quarantineLocId) throw new Error("Quarantine location not found");

            const wasteLocId = (await this.getWasteLocation(tenantId, client))?.id;
            if (!wasteLocId) throw new Error("WASTE location not found - please ensure tenant has system locations provisioned");

            // Group decisions by line to sum them up for validation
            const decisionsByLine = new Map<string, number>();
            decisions.forEach(d => {
                const current = decisionsByLine.get(d.returnLineId) || 0;
                decisionsByLine.set(d.returnLineId, current + d.qty);
            });

            // Validate Totals
            for (const [lineId, newTotalQty] of decisionsByLine.entries()) {
                const line = lineMap.get(lineId);
                if (!line) throw new Error(`Invalid return line id: ${lineId}`);

                const receivedQty = line.qty_received_units;
                const priorQty = priorDecisionsMap.get(lineId) || 0;
                const remainingQty = receivedQty - priorQty;

                if (newTotalQty > remainingQty) {
                    throw new Error(`Decision quantity ${newTotalQty} exceeds remaining undecided quantity ${remainingQty} for line ${lineId}`);
                }
            }

            // Execute Movements
            for (const decision of decisions) {
                if (decision.qty <= 0) continue;

                const line = lineMap.get(decision.returnLineId);

                // Determine destination location based on outcome
                // WASTE goes to WASTE location, others use provided destinationLocationId
                let toLocationId: string;
                if (decision.outcome === 'WASTE') {
                    toLocationId = wasteLocId;
                } else {
                    if (!decision.destinationLocationId) {
                        throw new Error(`Destination location required for ${decision.outcome}`);
                    }
                    toLocationId = decision.destinationLocationId;
                }

                // Insert Decision Line (store actual destination for all outcomes)
                await client.query(`
                    INSERT INTO return_decision_lines (id, decision_id, return_line_id, qty_units, outcome, destination_location_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [uuidv4(), decisionId, decision.returnLineId, decision.qty, decision.outcome, toLocationId]);

                // Inventory Movement (Quarantine -> Destination)
                await client.query(`
                    INSERT INTO inventory_movements (
                        movement_id, tenant_id, product_id, lot, expiry, qty_units,
                        from_location_id, to_location_id, document_type, document_id, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RETURN_DECISION', $9, $10)
                `, [
                    uuidv4(), tenantId, line.product_id, line.lot, line.expiry, decision.qty,
                    quarantineLocId, toLocationId, decisionId, userId
                ]);

                // Update Stock
                // 1. Decrement Quarantine
                await client.query(`
                    UPDATE current_stock
                    SET qty_units = qty_units - $1
                    WHERE tenant_id = $2 AND location_id = $3 AND product_id = $4 AND lot = $5 AND expiry = $6
                `, [decision.qty, tenantId, quarantineLocId, line.product_id, line.lot, line.expiry]);

                // 2. Increment Destination (always - including WASTE for tracking)
                await client.query(`
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location_id, qty_units)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(tenant_id, product_id, lot, location_id) 
                    DO UPDATE SET qty_units = current_stock.qty_units + EXCLUDED.qty_units
                `, [tenantId, line.product_id, line.lot, line.expiry, toLocationId, decision.qty]);
            }

            // 5. Check if we should close the Reception
            const finalCheck = await client.query(`
                 SELECT 
                    rrl.return_line_id,
                    rrl.qty_received_units,
                    COALESCE(SUM(rdl.qty_units), 0) as total_decided
                FROM return_reception_lines rrl
                LEFT JOIN return_decisions rd ON rd.reception_id = rrl.reception_id
                LEFT JOIN return_decision_lines rdl ON rdl.decision_id = rd.id AND rdl.return_line_id = rrl.return_line_id
                WHERE rrl.reception_id = $1
                GROUP BY rrl.return_line_id, rrl.qty_received_units
            `, [receptionId]);

            const allResolved = finalCheck.rows.every((row: any) => parseInt(row.total_decided) >= row.qty_received_units);

            if (allResolved) {
                await client.query('UPDATE return_receptions SET status = \'CLOSED\' WHERE id = $1', [receptionId]);
                
                // Only close return if all receptions are closed AND return is fully received?
                // For now, I'm skipping auto-closing stock_return here to respect the user's caution on "partial decisions".
                // But I will auto-close the RECEPTION if all its lines are decided.
            }

            return decisionId;
        });
    }

    async getDecisionsByReceptionId(tenantId: string, receptionId: string): Promise<any[]> {
        return tenantQuery(tenantId, `
            SELECT 
                rd.id, rd.decided_at,
                u.username, u.nom, u.prenom,
                rdl.return_line_id,
                rdl.qty_units,
                rdl.outcome,
                srl.product_id,
                srl.lot
            FROM return_decisions rd
            JOIN return_decision_lines rdl ON rd.id = rdl.decision_id
            JOIN stock_return_lines srl ON rdl.return_line_id = srl.id
            LEFT JOIN users u ON rd.decided_by = u.id
            WHERE rd.reception_id = $1
            ORDER BY rd.decided_at DESC
        `, [receptionId]);
    }

    private async getQuarantineLocation(tenantId: string, client: any) {
         const res = await client.query(`
            SELECT location_id as id FROM locations 
            WHERE tenant_id = $1 AND name = 'RETURN_QUARANTINE' AND status = 'ACTIVE'
            LIMIT 1
         `, [tenantId]);
         return res.rows[0];
    }

    private async getWasteLocation(tenantId: string, client: any) {
         const res = await client.query(`
            SELECT location_id as id FROM locations 
            WHERE tenant_id = $1 AND name = 'WASTE' AND status = 'ACTIVE'
            LIMIT 1
         `, [tenantId]);
         return res.rows[0];
    }


    /**
     * Get Return Details
     */
    async getReturnDetails(tenantId: string, returnId: string): Promise<StockReturn | null> {
        const rows = await tenantQuery(tenantId, 
            `SELECT * FROM stock_returns WHERE id = $1 AND tenant_id = $2`, 
            [returnId, tenantId]
        );
        if (rows.length === 0) return null;
        const row = rows[0];

        // Fetch lines with destination location from reservation + received quantities
        const lines = await tenantQuery(tenantId, `
            SELECT 
                rl.*, 
                res.destination_location_id,
                COALESCE((
                    SELECT SUM(rcl.qty_received_units) 
                    FROM return_reception_lines rcl 
                    WHERE rcl.return_line_id = rl.id
                ), 0) as qty_received_units
            FROM stock_return_lines rl
            LEFT JOIN stock_reservation_lines res ON rl.stock_reservation_line_id = res.id
            WHERE rl.return_id = $1
        `, [returnId]);

        // Fetch Product Names from Global DB
        let productMap: Record<string, any> = {};
        const productIds = Array.from(new Set(lines.map((l: any) => l.product_id)));
        
        if (productIds.length > 0) {
            try {
                // Safely import globalPg. If it fails (e.g. strict boundary), we continue without names.
                const { getGlobalPool } = await import('../db/globalPg'); 
                const globalPool = getGlobalPool();
                const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
                const products = await globalPool.query(
                    `SELECT id, name, dci FROM global_products WHERE id IN (${placeholders})`,
                    productIds
                );
                products.rows.forEach((p: any) => {
                    productMap[p.id] = p;
                });
            } catch (e) {
                console.error("Failed to fetch product names for return details", e);
                // Fallback: names remain 'Unknown' but operation succeeds
            }
        }

        return {
            id: row.id,
            tenant_id: row.tenant_id,
            return_reference: row.return_reference,
            service_id: row.source_service_id, // FIXED: Correct column mapping
            created_by: row.created_by,
            status: row.status,
            created_at: row.created_at,
            lines: lines.map((l: any) => ({
                id: l.id,
                return_id: l.return_id,
                product_id: l.product_id,
                product_name: productMap[l.product_id]?.name || 'Unknown',
                dci: productMap[l.product_id]?.dci || '',
                lot: l.lot,
                expiry: l.expiry,
                qty_declared_units: l.qty_declared_units,
                qty_received_units: parseInt(l.qty_received_units) || 0, // NEW: Already received
                source_location_id: l.source_location_id,
                destination_location_id: l.destination_location_id
            }))
        };
    }
}

export const stockReturnService = new StockReturnService();
