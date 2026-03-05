import { Request, Response } from 'express';
import { transfusionService } from '../services/transfusionService';
import { getTenantId } from '../middleware/authMiddleware';

export async function listBloodBags(req: Request, res: Response) {
    try {
        const tenantId = getTenantId(req as any);
        const { tenantPatientId } = req.params;
        const bags = await transfusionService.listPatientBloodBags(tenantId, tenantPatientId);
        res.status(200).json(bags);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function createBloodBag(req: Request, res: Response) {
    try {
        const tenantId = getTenantId(req as any);
        const userId = (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.user_id || (req as any).user?.id;
        
        if (!userId || userId === 'unknown') {
            return res.status(401).json({ error: "User ID missing from token or invalid (unknown)" });
        }

        const { tenantPatientId } = req.params;
        
        const payload = {
            ...req.body,
            tenant_patient_id: tenantPatientId
        };
        
        const bag = await transfusionService.createBloodBagReception(tenantId, userId, payload);
        res.status(201).json(bag);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function discardBloodBag(req: Request, res: Response) {
    try {
        const tenantId = getTenantId(req as any);
        const { id } = req.params;
        const bag = await transfusionService.discardBloodBag(tenantId, id);
        res.status(200).json(bag);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
}

export async function getTimeline(req: Request, res: Response) {
    try {
        const tenantId = getTenantId(req as any);
        const { tenantPatientId } = req.params;
        const timeline = await transfusionService.getTransfusionTimeline(tenantId, tenantPatientId);
        
        console.log(`[DEBUG] getTimeline for tenantId: ${tenantId}, patient: ${tenantPatientId}`);
        console.log(`[DEBUG] Found ${timeline.prescriptions.length} prescriptions.`);
        if (timeline.prescriptions.length > 0) {
           console.log(`[DEBUG] Prescription 1: type=${timeline.prescriptions[0].prescription_type}, status=${timeline.prescriptions[0].status}`);
        } else {
           // Let's do a raw query to see if ANY prescriptions exist for this patient to debug further
           const { tenantQuery } = require('../db/tenantPg');
           const raw = await tenantQuery(tenantId, `SELECT id, prescription_type, status FROM public.prescriptions WHERE tenant_patient_id = $1`, [tenantPatientId]);
           console.log(`[DEBUG] Raw query found ${raw.length} total prescriptions for this patient.`);
           if (raw.length > 0) {
               console.log(raw.slice(0, 3));
           }
        }
        
        res.status(200).json(timeline);
    } catch (error: any) {
        console.error('[DEBUG] Error getTimeline:', error);
        res.status(400).json({ error: error.message });
    }
}
