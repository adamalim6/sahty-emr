import { Request, Response } from 'express';
import { addictionsService } from '../services/addictionsService';

export class AddictionsController {

    async createAddiction(req: Request, res: Response) {
        try {
            const auth = (req as any).auth;
            const tenantId = auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });

            const payload = {
                ...req.body,
                created_by: auth.userId
            };

            const addiction = await addictionsService.createAddiction(tenantId, payload);
            res.status(201).json(addiction);
        } catch (error: any) {
            console.error("Error creating addiction:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async updateAddiction(req: Request, res: Response) {
        try {
            const auth = (req as any).auth;
            const tenantId = auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
            const { id } = req.params;

            const addiction = await addictionsService.updateAddiction(
                tenantId, 
                id, 
                auth.userId, 
                auth.firstName || 'User', 
                auth.lastName || '', 
                req.body
            );
            res.json(addiction);
        } catch (error: any) {
            console.error("Error updating addiction:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async updateAddictionStatus(req: Request, res: Response) {
        try {
            const auth = (req as any).auth;
            const tenantId = auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
            const { id } = req.params;
            const { status } = req.body;

            const addiction = await addictionsService.updateAddictionStatus(
                tenantId, 
                id, 
                auth.userId, 
                auth.firstName || 'User', 
                auth.lastName || '', 
                status
            );
            res.json(addiction);
        } catch (error: any) {
            console.error("Error updating addiction status:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async listPatientAddictions(req: Request, res: Response) {
        try {
            const tenantId = (req as any).auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            const { tenant_patient_id } = req.params;

            const addictions = await addictionsService.listPatientAddictions(tenantId, tenant_patient_id);
            res.json(addictions);
        } catch (error: any) {
            console.error("Error listing patient addictions:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async getAddictionHistory(req: Request, res: Response) {
        try {
            const tenantId = (req as any).auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            const { id } = req.params;

            const history = await addictionsService.getAddictionHistory(tenantId, id);
            res.json(history);
        } catch (error: any) {
            console.error("Error fetching addiction history:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async createAddictionObservation(req: Request, res: Response) {
        try {
            const auth = (req as any).auth;
            const tenantId = auth?.tenantId;
            if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
            if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
            const { id } = req.params;

            // Extract clinical metadata mapping
            const authorRole = auth.role === 'SUPER_ADMIN' || auth.role === 'MEDECIN' || auth.role === 'DOCTOR' ? 'DOCTOR' : 'NURSE';
            const authorFirstName = auth.firstName || 'User';
            const authorLastName = auth.lastName || '';

            const obs = await addictionsService.createAddictionObservation(
                tenantId,
                id,
                auth.userId,
                authorRole,
                authorFirstName,
                authorLastName,
                req.body
            );
            res.status(201).json(obs);
        } catch (error: any) {
            console.error("Error creating addiction observation:", error);
            res.status(400).json({ error: error.message });
        }
    }
}

export const addictionsController = new AddictionsController();
