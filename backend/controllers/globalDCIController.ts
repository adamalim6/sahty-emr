
import { Request, Response } from 'express';
import { globalDCIService } from '../services/GlobalDCIService';

import { referenceDataService } from '../services/referenceDataService';

export const getAllDCIs = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId || (req as any).user?.client_id || (req as any).user?.tenantId;
        const isTenantUser = tenantId && tenantId !== 'GLOBAL';

        if (isTenantUser) {
            const q = (req.query.q as string) || (req.query.search as string) || '';
            const dcis = await referenceDataService.getDCIs(tenantId, q);
            return res.json({ data: dcis }); // Unified format
        }

        if (req.query.page || req.query.limit) {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            // The query param might be 'search' or 'q'. Let's support 'q' based on plan.
            const q = (req.query.q as string) || '';

            const result = await globalDCIService.getDCIsPaginated(page, limit, q);
            return res.json(result);
        }

        const dcis = await globalDCIService.getAllDCIs();
        res.json(dcis);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createDCI = async (req: Request, res: Response) => {
    try {
        const dci = await globalDCIService.createDCI(req.body);
        res.status(201).json(dci);
    } catch (error: any) {
        if (error.message.includes('existe déjà')) {
             res.status(409).json({ message: error.message });
        } else {
             res.status(400).json({ message: error.message });
        }
    }
};

export const updateDCI = async (req: Request, res: Response) => {
    try {
        const dci = await globalDCIService.updateDCI(req.params.id, req.body);
        res.json(dci);
    } catch (error: any) {
         if (error.message.includes('existe déjà')) {
             res.status(409).json({ message: error.message });
        } else if (error.message === 'DCI non trouvée') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(400).json({ message: error.message });
        }
    }
};

export const deleteDCI = async (req: Request, res: Response) => {
    try {
        await globalDCIService.deleteDCI(req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
