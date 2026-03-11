import { Request, Response } from 'express';
import { observationsService } from '../services/observationsService';

export const listPatientObservations = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId;
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const { tenantPatientId } = req.params;
        const observations = await observationsService.listPatientObservations(tenantId, tenantPatientId);
        res.status(200).json(observations);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const createObservation = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId;
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        // Explicitly cast to internal auth standard
        const auth = (req as any).auth;
        if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

        // Infer role from token's global role code
        const authorRole = auth.role === 'MEDECIN' ? 'DOCTOR' : 'NURSE';

        const observation = await observationsService.createObservation(tenantId, auth.userId, authorRole, auth.firstName || '', auth.lastName || '', req.body);
        res.status(201).json(observation);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const updateDraftObservation = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId;
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const auth = (req as any).auth;
        if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

        const observation = await observationsService.updateDraftObservation(tenantId, req.params.id, auth.userId, req.body);
        res.status(200).json(observation);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const signObservation = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId;
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const auth = (req as any).auth;
        if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

        const observation = await observationsService.signObservation(tenantId, req.params.id, auth.userId);
        res.status(200).json(observation);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const createAddendum = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).auth?.tenantId;
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const auth = (req as any).auth;
        if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

        const authorRole = auth.role === 'MEDECIN' ? 'DOCTOR' : 'NURSE';
        const observation = await observationsService.createAddendum(tenantId, req.params.id, auth.userId, authorRole, auth.firstName || '', auth.lastName || '', req.body);
        res.status(201).json(observation);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};
