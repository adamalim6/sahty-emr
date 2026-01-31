
import express from 'express';
import { stockReservationService } from '../services/stockReservationService';
import { getTenantId } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * POST /hold - Add item to cart
 * Creates header (if new session) + adds line + increments reserved_units
 */
router.post('/hold', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { 
            session_id, product_id, lot, expiry, 
            source_location_id, destination_location_id, qty_units, 
            stock_demand_id, stock_demand_line_id 
        } = req.body;
        
        const userId = (req as any).user?.userId || 'SYSTEM';

        // Support legacy location_id field
        const srcLocId = source_location_id || req.body.location_id;

        const line = await stockReservationService.hold(tenantId, {
            session_id,
            user_id: userId,
            stock_demand_id,
            stock_demand_line_id,
            product_id,
            lot,
            expiry,
            source_location_id: srcLocId,
            destination_location_id,
            qty_units
        });
        
        res.status(201).json(line);
    } catch (error: any) {
        if (error.message.includes('INSUFFICIENT_AVAILABLE_STOCK')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
});

/**
 * PATCH /line/:lineId - Update line quantity (delta-based)
 */
router.patch('/line/:lineId', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { lineId } = req.params;
        const { qty_units } = req.body;

        const updatedLine = await stockReservationService.updateLine(tenantId, lineId, qty_units);
        res.json(updatedLine);
    } catch (error: any) {
        if (error.message.includes('INSUFFICIENT_AVAILABLE_STOCK')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
});

/**
 * DELETE /line/:lineId - Remove item from cart
 */
router.delete('/line/:lineId', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { lineId } = req.params;
        await stockReservationService.release(tenantId, lineId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * POST /release - Release single line (legacy compat)
 */
router.post('/release', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { reservation_id, line_id } = req.body;
        // Support both old reservation_id and new line_id
        const lineId = line_id || reservation_id;
        await stockReservationService.release(tenantId, lineId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * POST /release-session - Cancel entire cart
 */
router.post('/release-session', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { session_id } = req.body;
        const count = await stockReservationService.releaseSession(tenantId, session_id);
        res.json({ success: true, released_count: count });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * POST /refresh-session - Extend expiry
 */
router.post('/refresh-session', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { session_id } = req.body;
        await stockReservationService.refreshSession(tenantId, session_id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /cart/:sessionId - Get header + lines
 */
router.get('/cart/:sessionId', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { sessionId } = req.params;
        const cart = await stockReservationService.getSessionCart(tenantId, sessionId);
        
        if (!cart) {
            return res.json({ header: null, lines: [] });
        }
        res.json(cart);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * POST /commit - Commit cart and create transfer
 */
router.post('/commit', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { session_id, related_demand_id } = req.body;
        const userId = (req as any).user?.userId || 'SYSTEM';

        const transferId = await stockReservationService.commitSession(
            tenantId, session_id, related_demand_id, userId
        );
        res.json({ success: true, transfer_id: transferId });
    } catch (error: any) {
        console.error('Commit failed:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
