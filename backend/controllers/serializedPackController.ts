import { Request, Response } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { AuthRequest, getTenantId } from '../middleware/authMiddleware';

export const getSerializedPacks = (req: Request, res: Response) => {
    try {
        const { productId, status, locationId } = req.query;
        const tenantId = getTenantId(req as any);

        const packs = pharmacyService.getSerializedPacks({
            tenantId,
            productId: productId as string | undefined,
            status: status as any,
            locationId: locationId as string | undefined
        });

        res.json(packs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching serialized packs' });
    }
};

export const getSerializedPackById = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = getTenantId(req as any);
        const pack = pharmacyService.getSerializedPackById(tenantId, id);

        if (!pack) {
            return res.status(404).json({ message: 'Pack not found' });
        }

        res.json(pack);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pack' });
    }
};
