import { Request, Response } from 'express';
import { tenantObservationCatalogService } from '../services/tenantObservationCatalogService';

export const getFlowsheets = async (req: Request, res: Response) => {
    try {
        const auth = (req as any).auth;
        if (!auth?.tenantId) {
            return res.status(400).json({ message: "Tenant ID required for EMR catalog access." });
        }
        const flowsheets = await tenantObservationCatalogService.getFlowsheets(auth.tenantId, true);
        res.json(flowsheets);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getUnits = async (req: Request, res: Response) => {
    try {
        const auth = (req as any).auth;
        if (!auth?.tenantId) {
            return res.status(400).json({ message: "Tenant ID required for EMR catalog access." });
        }
        const units = await tenantObservationCatalogService.getUnits(auth.tenantId);
        res.json(units);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getGroups = async (req: Request, res: Response) => {
    try {
        const auth = (req as any).auth;
        if (!auth?.tenantId) {
            return res.status(400).json({ message: "Tenant ID required for EMR catalog access." });
        }
        const groups = await tenantObservationCatalogService.getGroups(auth.tenantId);
        res.json(groups);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getParameters = async (req: Request, res: Response) => {
    try {
        const auth = (req as any).auth;
        if (!auth?.tenantId) {
            return res.status(400).json({ message: "Tenant ID required for EMR catalog access." });
        }
        const parameters = await tenantObservationCatalogService.getParameters(auth.tenantId);
        res.json(parameters);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
