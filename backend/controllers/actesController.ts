
import { Request, Response } from 'express';
import { globalActesService } from '../services/globalActesService';
import { referenceDataService } from '../services/referenceDataService';

export const getActes = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const isTenantUser = tenantId && tenantId !== 'GLOBAL';

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string;

        let result;
        if (isTenantUser) {
            result = await referenceDataService.getGlobalActesPaginated(tenantId, page, limit, search);
        } else {
            result = await globalActesService.getAllPaginated(page, limit, search);
        }
        
        res.json({
            data: result.data,
            total: result.total,
            page,
            totalPages: Math.ceil(result.total / limit)
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateActe = async (req: Request, res: Response) => {
    // Updates not fully implemented in SQL service yet, 
    // but preserving the endpoint structure for future use.
    res.status(501).json({ message: "Update not yet implemented in SQL version" });
};
