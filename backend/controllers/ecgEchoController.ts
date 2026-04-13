import { Request, Response } from 'express';
import { getTenantId } from '../middleware/authMiddleware';
import * as svc from '../services/ecgEchoService';

// ─── ECG ──────────────────────────────────────────────────────────────────────

export const listECGs = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const data = await svc.getECGsByPatient(tenantId, req.params.patientId);
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createECG = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const { conclusionHtml = '<p></p>', conclusionPlain = '', ...formData } = req.body;
        const auth = (req as any).auth;
        const userId = auth?.userId ?? null;
        const enriched = {
            ...formData,
            creatorFirstName: auth?.firstName ?? null,
            creatorLastName: auth?.lastName ?? null,
        };
        const record = await svc.createECG(tenantId, req.params.patientId, enriched, userId, conclusionHtml, conclusionPlain);
        res.status(201).json(record);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateECG = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const { conclusionHtml = '<p></p>', conclusionPlain = '', ...formData } = req.body;
        const userId = (req as any).auth?.userId ?? null;
        const record = await svc.updateECG(tenantId, req.params.ecgId, formData, conclusionHtml, conclusionPlain, userId);
        res.json(record);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteECG = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        await svc.deleteECG(tenantId, req.params.ecgId);
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const enterECGInError = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const userId = (req as any).auth?.userId ?? null;
        const { reason } = req.body;
        await svc.enterECGInError(tenantId, req.params.ecgId, userId, reason);
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Echo ─────────────────────────────────────────────────────────────────────

export const listEchos = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const data = await svc.getEchosByPatient(tenantId, req.params.patientId);
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createEcho = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const { conclusionHtml = '<p></p>', conclusionPlain = '', ...formData } = req.body;
        const auth = (req as any).auth;
        const userId = auth?.userId ?? null;
        const enriched = {
            ...formData,
            creatorFirstName: auth?.firstName ?? null,
            creatorLastName: auth?.lastName ?? null,
        };
        const record = await svc.createEcho(tenantId, req.params.patientId, enriched, userId, conclusionHtml, conclusionPlain);
        res.status(201).json(record);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateEcho = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const { conclusionHtml = '<p></p>', conclusionPlain = '', ...formData } = req.body;
        const userId = (req as any).auth?.userId ?? null;
        const record = await svc.updateEcho(tenantId, req.params.echoId, formData, conclusionHtml, conclusionPlain, userId);
        res.json(record);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteEcho = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        await svc.deleteEcho(tenantId, req.params.echoId);
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const enterEchoInError = async (req: Request, res: Response) => {
    try {
        const tenantId = getTenantId(req as any);
        const userId = (req as any).auth?.userId ?? null;
        const { reason } = req.body;
        await svc.enterEchoInError(tenantId, req.params.echoId, userId, reason);
        res.status(204).send();
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
