import { Request, Response } from 'express';
import { allergiesService } from '../services/allergiesService';
import { getTenantId } from '../middleware/authMiddleware';

export const getPatientAllergies = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const tenantPatientId = req.params.tenantPatientId;
        const filter = (req.query.filter as 'active' | 'all') || 'active';

        const allergies = await allergiesService.getPatientAllergies(tenantId, tenantPatientId, filter);
        res.json(allergies);
    } catch (error: any) {
        console.error('getPatientAllergies error', error);
        res.status(500).json({ error: error.message });
    }
};

export const createAllergy = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const tenantPatientId = req.params.tenantPatientId;
        const userId = (req as any).auth?.userId || null;
        const firstName = (req as any).auth?.firstName || null;
        const lastName = (req as any).auth?.lastName || null;

        const newAllergy = await allergiesService.createAllergy(tenantId, tenantPatientId, req.body, userId, firstName, lastName);
        res.status(201).json(newAllergy);
    } catch (error: any) {
        console.error('createAllergy error', error);
        res.status(400).json({ error: error.message });
    }
};

export const updateAllergy = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const allergyId = req.params.id;
        const userId = (req as any).auth?.userId || null;
        const firstName = (req as any).auth?.firstName || null;
        const lastName = (req as any).auth?.lastName || null;

        const updatedAllergy = await allergiesService.updateAllergyDetails(tenantId, allergyId, req.body, userId, firstName, lastName);
        res.json(updatedAllergy);
    } catch (error: any) {
        console.error('updateAllergy error', error);
        res.status(400).json({ error: error.message });
    }
};

export const changeAllergyStatus = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const allergyId = req.params.id;
        const userId = (req as any).auth?.userId || null;
        const firstName = (req as any).auth?.firstName || null;
        const lastName = (req as any).auth?.lastName || null;
        const { status } = req.body;
        
        if (!['ACTIVE', 'RESOLVED', 'ENTERED_IN_ERROR'].includes(status)) {
            res.status(400).json({ error: 'Statut invalide' });
            return;
        }

        await allergiesService.changeAllergyStatus(tenantId, allergyId, status as any, userId, firstName, lastName);
        res.json({ success: true });
    } catch (error: any) {
        console.error('changeAllergyStatus error', error);
        res.status(400).json({ error: error.message });
    }
};

export const getAllergyHistory = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const allergyId = req.params.id;

        const history = await allergiesService.getAllergyHistory(tenantId, allergyId);
        res.json(history);
    } catch (error: any) {
        console.error('getAllergyHistory error', error);
        res.status(500).json({ error: error.message });
    }
};
