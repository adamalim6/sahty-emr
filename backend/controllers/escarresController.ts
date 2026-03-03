import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { EscarresService } from '../services/escarresService';

// Middleware expectation: `req.user` must be populated with { tenantId, userId }
export const getActiveEscarres = async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const tenantPatientId = req.params.tenantPatientId;

        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });
        if (!tenantPatientId) return res.status(400).json({ error: "Missing tenantPatientId" });

        const escarres = await EscarresService.getEscarresForPatient(tenantId, tenantPatientId);
        res.json(escarres);
    } catch (e: any) {
        console.error("Error fetching escarres:", e);
        res.status(500).json({ error: e.message || "Internal server error" });
    }
};

export const createEscarre = async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const createdBy = req.user?.userId || null;
        
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        // Body must match CreateEscarrePayload natively mapped by Express body parser
        const payload = req.body;
        
        if (!payload.tenantPatientId || payload.posX === undefined || payload.posY === undefined || payload.posZ === undefined || !payload.snapshot) {
             return res.status(400).json({ error: "Missing required 3D positional base parameters or snapshot" });
        }

        const newEscarre = await EscarresService.createEscarre(tenantId, createdBy, payload);
        res.status(201).json(newEscarre);
    } catch (e: any) {
        console.error("Error creating escarre:", e);
        res.status(500).json({ error: e.message || "Internal server error" });
    }
};

export const getEscarreDetails = async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const escarreId = req.params.id;

        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const details = await EscarresService.getEscarreWithHistory(tenantId, escarreId);
        res.json(details);
    } catch (e: any) {
        console.error("Error fetching escarre details:", e);
        res.status(500).json({ error: e.message || "Internal server error" });
    }
};

export const addSnapshot = async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const escarreId = req.params.id;
        const recordedBy = req.user?.userId || null;
        
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const snapshot = await EscarresService.addSnapshot(tenantId, escarreId, recordedBy, req.body);
        res.status(201).json(snapshot);
    } catch (e: any) {
        console.error("Error creating escarre snapshot:", e);
        res.status(500).json({ error: e.message || "Internal server error" });
    }
};

export const deactivateEscarre = async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const escarreId = req.params.id;
        
        if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

        const deactivated = await EscarresService.deactivateEscarre(tenantId, escarreId);
        res.json(deactivated);
    } catch (e: any) {
        console.error("Error resolving escarre:", e);
        res.status(500).json({ error: e.message || "Internal server error" });
    }
};
