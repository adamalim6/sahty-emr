import { Request, Response } from 'express';
import { getTenantId, AuthRequest } from '../middleware/authMiddleware';
import { clinicalExamsService } from '../services/clinicalExamsService';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    const authReq = req as any;
    
    // Fallbacks to grab full names securely
    const firstName = authReq.auth?.firstName || authReq.user?.first_name || null;
    const lastName = authReq.auth?.lastName || authReq.user?.last_name || null;
    const userId = authReq.auth?.userId || authReq.user?.userId;

    return { tenantId, userId, firstName, lastName };
};

export const getClinicalExams = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { patientId } = req.params;
        const includeError = req.query.includeError === 'true';

        if (!patientId) {
            return res.status(400).json({ error: 'Missing patientId' });
        }

        const data = await clinicalExamsService.getPatientExams(tenantId, patientId, includeError);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createClinicalExam = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, userId, firstName, lastName } = getContext(req);
        const { patientId } = req.params;
        const { date, ...payload } = req.body; // Map 'date' inside UI payload to 'observedAt'

        if (!patientId || !date) {
            return res.status(400).json({ error: 'Missing patientId or observation date' });
        }

        const data = await clinicalExamsService.createExam(tenantId, patientId, date, userId, firstName, lastName, payload);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateClinicalExam = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, userId, firstName, lastName } = getContext(req);
        const { patientId, examId } = req.params;
        const { date, ...payload } = req.body; 

        if (!patientId || !examId || !date) {
            return res.status(400).json({ error: 'Missing required routing/date params' });
        }

        const data = await clinicalExamsService.updateExam(tenantId, patientId, examId, date, userId, firstName, lastName, payload);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const invalidateClinicalExam = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, userId, firstName, lastName } = getContext(req);
        const { patientId, examId } = req.params;
        const { reason } = req.body;

        if (!patientId || !examId) {
            return res.status(400).json({ error: 'Missing required params' });
        }

        const data = await clinicalExamsService.markEnteredInError(tenantId, patientId, examId, reason || 'Invalidated by clinician', userId, firstName, lastName);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
