import { Request, Response } from 'express';
import { getTenantId } from '../../middleware/authMiddleware';
import { limsReceptionService } from '../../services/lims/limsReceptionService';

export const limsReceptionController = {

    async getSpecimenByBarcode(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { barcode } = req.params;

            if (!barcode || barcode.trim().length === 0) {
                return res.status(400).json({ error: 'Barcode is required' });
            }

            const specimen = await limsReceptionService.getSpecimenByBarcode(tenantId, barcode.trim());

            if (!specimen) {
                return res.status(404).json({ error: 'Prélèvement introuvable' });
            }

            res.json(specimen);
        } catch (err: any) {
            console.error('Error fetching specimen by barcode:', err);
            res.status(500).json({ error: err.message });
        }
    },

    async receiveSpecimen(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const userId = (req as any).user?.userId;
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const { specimenId } = req.body;
            if (!specimenId) return res.status(400).json({ error: 'specimenId is required' });

            const result = await limsReceptionService.receiveSpecimen(tenantId, specimenId, userId);
            res.json(result);
        } catch (err: any) {
            console.error('Error receiving specimen:', err);
            res.status(400).json({ error: err.message });
        }
    },

    async rejectSpecimen(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const userId = (req as any).user?.userId;
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const { specimenId, reason } = req.body;
            if (!specimenId) return res.status(400).json({ error: 'specimenId is required' });
            if (!reason) return res.status(400).json({ error: 'reason is required' });

            const result = await limsReceptionService.rejectSpecimen(tenantId, specimenId, userId, reason);
            res.json(result);
        } catch (err: any) {
            console.error('Error rejecting specimen:', err);
            res.status(400).json({ error: err.message });
        }
    },

    async markInsufficient(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const userId = (req as any).user?.userId;
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const { specimenId } = req.body;
            if (!specimenId) return res.status(400).json({ error: 'specimenId is required' });

            const result = await limsReceptionService.markInsufficientSpecimen(tenantId, specimenId, userId);
            res.json(result);
        } catch (err: any) {
            console.error('Error marking specimen insufficient:', err);
            res.status(400).json({ error: err.message });
        }
    }
};
