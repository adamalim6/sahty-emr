import { Request, Response } from 'express';
import { limsExecutionService } from '../../services/lims/limsExecutionService';

export const limsExecutionController = {
    async submitLabRequests(req: Request, res: Response) {
        try {
            if (req.body.userId || req.body.created_by_user_id || req.body.created_by) {
                return res.status(400).json({ error: "Forbidden: user identity must not be provided in payload" });
            }

            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const userId = (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id || (req as any).user?.user_id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized: Missing user context" });
            }

            const payload = req.body;

            const result = await limsExecutionService.createLabRequests(tenantId, payload, userId);
            res.status(201).json(result);
        } catch (e: any) {
            console.error('submitLabRequests Error:', e);
            res.status(400).json({ error: e.message });
        }
    },

    async getActiveWalkinAdmission(req: Request, res: Response) {
        try {
            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const patientId = req.params.patientId;
            const result = await limsExecutionService.getActiveWalkinAdmission(tenantId, patientId);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getCollectionRequirements(req: Request, res: Response) {
        try {
            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const admissionId = req.params.admissionId;
            const result = await limsExecutionService.getCollectionRequirements(tenantId, admissionId);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async executePrelevement(req: Request, res: Response) {
        try {
            if (req.body.userId || req.body.created_by_user_id || req.body.created_by) {
                return res.status(400).json({ error: "Forbidden: user identity must not be provided in payload" });
            }

            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const userId = (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id || (req as any).user?.user_id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized: Missing user context" });
            }
            
            const result = await limsExecutionService.executePrelevement(tenantId, userId, req.body);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async printBarcode(req: Request, res: Response) {
        try {
            console.log('[LIMS PRINTER] Print job dispatched:', req.body);
            // Simulate printer network delay
            await new Promise(resolve => setTimeout(resolve, 300));
            res.json({ success: true, timestamp: new Date().toISOString() });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getSurveillanceCandidates(req: Request, res: Response) {
        try {
            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const prescriptionEventId = req.query.prescriptionEventId as string;
            if (!prescriptionEventId) throw new Error('prescriptionEventId is required');

            const result = await limsExecutionService.getSurveillanceCandidates(tenantId, prescriptionEventId);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async executeSurveillanceCollection(req: Request, res: Response) {
        try {
            if (req.body.userId || req.body.created_by_user_id || req.body.created_by) {
                return res.status(400).json({ error: "Forbidden: user identity must not be provided in payload" });
            }

            const tenantId = (req as any).auth?.tenantId || (req as any).user?.tenant_id;
            const userId = (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id || (req as any).user?.user_id;
            
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized: Missing user context" });
            }

            const result = await limsExecutionService.executeSurveillanceCollection(tenantId, userId, req.body);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
