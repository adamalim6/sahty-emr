
import express from 'express';
import { stockReservationService } from '../services/stockReservationService';
import { getTenantId } from '../middleware/authMiddleware';

const router = express.Router();

// HOLD (Add to Cart)
router.post('/hold', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { session_id, product_id, lot, expiry, location_id, qty_units, demand_id, demand_line_id, client_request_id } = req.body;
        
        // Use user ID from auth context
        const userId = (req as any).user?.id || 'SYSTEM';

        const reservation = await stockReservationService.hold(tenantId, {
            session_id,
            user_id: userId,
            demand_id,
            demand_line_id,
            product_id,
            lot,
            expiry,
            location_id,
            qty_units,
            client_request_id
        });
        
        res.status(201).json(reservation);
    } catch (error: any) {
        if (error.message.includes('Insufficient stock')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
});

// RELEASE (Remove from Cart)
router.post('/release', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { reservation_id } = req.body;
        await stockReservationService.release(tenantId, reservation_id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// REFRESH SESSION
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

// GET CART (For sync/recovery)
router.get('/cart/:sessionId', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { sessionId } = req.params;
        const cart = await stockReservationService.getSessionCart(tenantId, sessionId);
        res.json(cart);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// COMMIT (Transfer)
router.post('/commit', async (req, res) => {
    try {
        const tenantId = getTenantId(req as any);
        const { session_id, related_demand_id } = req.body;
        const userId = (req as any).user?.id || 'SYSTEM';

        const transferId = await stockReservationService.commitSession(tenantId, session_id, related_demand_id, userId);
        res.json({ success: true, transfer_id: transferId });
    } catch (error: any) {
        console.error('Commit failed:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
