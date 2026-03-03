import { Request, Response } from 'express';
import { getTenantId, AuthRequest } from '../middleware/authMiddleware';
import { surveillanceService } from '../services/surveillanceService';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    const authReq = req as any;
    return { tenantId, user: authReq.user, auth: authReq.auth };
};

export const getSurveillanceTimeline = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { admission_id, from, to, flowsheet_id } = req.query;
        const tenant_patient_id = req.params.patientId;

        if (!tenant_patient_id || !from || !to) {
            return res.status(400).json({ error: 'Missing required parameters: patientId, from, to' });
        }

        const data = await surveillanceService.getTimeline(
            tenantId, 
            tenant_patient_id as string, 
            admission_id ? String(admission_id) : null, 
            from as string, 
            to as string, 
            flowsheet_id as string | undefined
        );

        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateSurveillanceCell = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        console.log("updateSurveillanceCell incoming payload:", req.body);
        const { 
            admissionId, 
            tenantPatientId, 
            parameterId, 
            parameterCode,
            recordedAt, 
            value
        } = req.body;

        if (!tenantPatientId || !parameterId || !parameterCode || !recordedAt) {
            return res.status(400).json({ error: 'Missing required body fields', missing: ['tenantPatientId', 'parameterId', 'parameterCode', 'recordedAt'] });
        }

        const userId = user?.userId || (req as any).auth?.userId;

        const result = await surveillanceService.updateCell(
            tenantId,
            tenantPatientId,
            admissionId || null,
            recordedAt,
            parameterId,
            parameterCode,
            value,
            userId
        );

        res.json(result);
        } catch (error: any) {
        if (error.message === 'REVISION_MISMATCH') {
            return res.status(409).json({ 
                error: 'Conflict: This cell was modified concurrently. Please review the new value.',
                currentRow: error.currentRow
            });
        }
        if (error.message === 'LIMIT_VIOLATION') {
            return res.status(422).json({ error: error.message });
        }
        res.status(500).json({ message: error.message });
    }
};
