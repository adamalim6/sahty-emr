import { getTenantDB } from '../db/tenantDb';
import sqlite3 from 'sqlite3';

export interface StockDemand {
    id: string; // request_id in DB
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

// Helper functions for sqlite3
const run = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve();
        });
    });
};

const get = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

const all = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

class StockTransferService {

    // --- DEMAND (INTENT) LAYER ---

    async createDemand(tenantId: string, demand: Omit<StockDemand, 'id' | 'status' | 'created_at'>): Promise<string> {
        const db = await getTenantDB(tenantId);
        const demandId = `dem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        try {
            await run(db, 'BEGIN TRANSACTION');
            
            await run(db, `
                INSERT INTO stock_demands (request_id, tenant_id, service_id, status, priority, requested_by)
                VALUES (?, ?, ?, 'SUBMITTED', ?, ?)
            `, [demandId, tenantId, demand.service_id, demand.priority || 'ROUTINE', demand.requested_by]);

            if (demand.items) {
                for (const item of demand.items) {
                    await run(db, `
                        INSERT INTO stock_demand_lines (request_id, tenant_id, product_id, qty_requested)
                        VALUES (?, ?, ?, ?)
                    `, [demandId, tenantId, item.product_id, item.qty_requested]);
                }
            }

            await run(db, 'COMMIT');
        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }

        return demandId;
    }

    async getDemands(tenantId: string, serviceId?: string): Promise<StockDemand[]> {
        const db = await getTenantDB(tenantId);
        let sql = `SELECT * FROM stock_demands WHERE tenant_id = ?`;
        const params: any[] = [tenantId];

        if (serviceId) {
            sql += ` AND service_id = ?`;
            params.push(serviceId);
        }
        
        sql += ` ORDER BY created_at DESC`;

        const rows = await all(db, sql, params);
        
        // Map to interface
        return rows.map(r => ({
            id: r.request_id,
            tenant_id: r.tenant_id,
            service_id: r.service_id,
            status: r.status,
            priority: r.priority,
            requested_by: r.requested_by,
            created_at: r.created_at
        }));
    }

    async getDemandDetails(tenantId: string, demandId: string): Promise<StockDemand | null> {
        const db = await getTenantDB(tenantId);
        const row = await get(db, `SELECT * FROM stock_demands WHERE request_id = ? AND tenant_id = ?`, [demandId, tenantId]);
        
        if (!row) return null;

        const items = await all(db, `SELECT * FROM stock_demand_lines WHERE request_id = ?`, [demandId]);

        return {
            id: row.request_id,
            tenant_id: row.tenant_id,
            service_id: row.service_id,
            status: row.status,
            priority: row.priority,
            requested_by: row.requested_by,
            created_at: row.created_at,
            items: items.map(i => ({
                demand_id: i.request_id,
                product_id: i.product_id,
                qty_requested: i.qty_requested
            }))
        };
    }

    async updateDemandStatus(tenantId: string, demandId: string, status: string) {
        const db = await getTenantDB(tenantId);
        
        try {
            await run(db, 'BEGIN TRANSACTION');

            await run(db, `UPDATE stock_demands SET status = ? WHERE request_id = ? AND tenant_id = ?`, [status, demandId, tenantId]);

            await run(db, 'COMMIT');
        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }
    }

    // --- TRANSFER (EXECUTION) LAYER ---

    async createTransferDraft(tenantId: string, transfer: Omit<StockTransfer, 'id' | 'status' | 'created_at'>): Promise<string> {
        const db = await getTenantDB(tenantId);
        const transferId = `trf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        try {
            await run(db, 'BEGIN TRANSACTION');

            await run(db, `
                INSERT INTO stock_transfers (id, tenant_id, demand_id, source_location_id, destination_location_id, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            `, [transferId, tenantId, transfer.demand_id, transfer.source_location_id, transfer.destination_location_id]);

            if (transfer.items) {
                for (const item of transfer.items) {
                    const lineId = `tln_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    await run(db, `
                        INSERT INTO stock_transfer_lines (id, tenant_id, transfer_id, product_id, lot, expiry, qty_transferred, demand_line_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [lineId, tenantId, transferId, item.product_id, item.lot, item.expiry, item.qty_transferred, item.demand_line_id]);
                }
            }

            await run(db, 'COMMIT');
        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }

        return transferId;
    }

    async getTransferDetails(tenantId: string, transferId: string): Promise<StockTransfer | null> {
        const db = await getTenantDB(tenantId);
        const row = await get(db, `SELECT * FROM stock_transfers WHERE id = ? AND tenant_id = ?`, [transferId, tenantId]);
        if (!row) return null;
        
        const lines = await all(db, `SELECT * FROM stock_transfer_lines WHERE transfer_id = ?`, [transferId]);
        
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
        const db = await getTenantDB(tenantId);
        
        try {
            await run(db, 'BEGIN TRANSACTION');

            // 1. Get Transfer
            const transfer = await get(db, `SELECT * FROM stock_transfers WHERE id = ? AND tenant_id = ?`, [transferId, tenantId]);
            if (!transfer) throw new Error('Transfer not found');
            if (transfer.status === 'COMPLETED') throw new Error('Transfer already completed');

            const lines = await all(db, `SELECT * FROM stock_transfer_lines WHERE transfer_id = ?`, [transferId]);

            for (const line of lines) {
                // Verify Stock
                const stock = await get(db, `SELECT qty_units FROM current_stock WHERE tenant_id = ? AND location = ? AND product_id = ? AND lot = ?`, 
                    [tenantId, transfer.source_location_id, line.product_id, line.lot]);
                
                if (!stock || stock.qty_units < line.qty_transferred) {
                     throw new Error(`Insufficient stock for product ${line.product_id} lot ${line.lot}`);
                }

                // Decrement Source
                await run(db, `UPDATE current_stock SET qty_units = qty_units - ? WHERE tenant_id = ? AND location = ? AND product_id = ? AND lot = ?`,
                    [line.qty_transferred, tenantId, transfer.source_location_id, line.product_id, line.lot]);

                // Increment Destination
                await run(db, `
                    INSERT INTO current_stock (tenant_id, product_id, lot, expiry, location, qty_units)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(tenant_id, product_id, lot, location) 
                    DO UPDATE SET qty_units = qty_units + excluded.qty_units
                `, [tenantId, line.product_id, line.lot, line.expiry, transfer.destination_location_id, line.qty_transferred]);

                // Log Movement
                const moveId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                await run(db, `
                    INSERT INTO inventory_movements (movement_id, tenant_id, product_id, lot, expiry, qty_units, from_location, to_location, document_type, document_id, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TRANSFER', ?, ?)
                `, [moveId, tenantId, line.product_id, line.lot, line.expiry, line.qty_transferred, transfer.source_location_id, transfer.destination_location_id, transferId, userId]);
            }

            // 3. Complete Transfer
            await run(db, `UPDATE stock_transfers SET status = 'COMPLETED', validated_at = CURRENT_TIMESTAMP, validated_by = ? WHERE id = ?`, [userId, transferId]);

            // 4. Update Linked Demand
            if (transfer.demand_id) {
                 await run(db, `UPDATE stock_demands SET status = 'FILLED' WHERE request_id = ?`, [transfer.demand_id]);
            }

            await run(db, 'COMMIT');
        } catch (error) {
            await run(db, 'ROLLBACK');
            throw error;
        }
    }

    async getTransferHistory(tenantId: string, productId: string): Promise<any[]> {
        const db = await getTenantDB(tenantId);
        // Get completed transfer lines for this product
        const sql = `
            SELECT 
                stl.qty_transferred,
                stl.lot,
                st.validated_at as date,
                st.id as transfer_id,
                st.status
            FROM stock_transfer_lines stl
            JOIN stock_transfers st ON st.id = stl.transfer_id
            WHERE st.tenant_id = ? 
            AND stl.product_id = ?
            AND st.status = 'COMPLETED'
            ORDER BY st.validated_at DESC
            LIMIT 5
        `;
        
        return all(db, sql, [tenantId, productId]);
    }
}

export const stockTransferService = new StockTransferService();
