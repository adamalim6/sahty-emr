import { Request, Response } from 'express';
import { referenceDataService } from '../services/referenceDataService';

export const getTenantActes = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId || tenantId === 'GLOBAL') {
            return res.status(403).json({ error: "Tenant context required for this endpoint" });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string;
        const family = req.query.family as string; // [NEW] Fetch biology by family

        const result = await referenceDataService.getGlobalActesPaginated(tenantId, page, limit, search, family);
        
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

export const getTenantActeById = async (req: Request, res: Response) => {
    res.status(501).json({ message: "Not yet implemented" });
};
