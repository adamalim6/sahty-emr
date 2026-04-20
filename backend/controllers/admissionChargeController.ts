import { Request, Response } from 'express';
import { admissionChargeService } from '../services/admissionChargeService';

const getTenantId = (req: Request) => (req as any).auth?.tenantId || (req as any).user?.tenant_id;
const getUserId = (req: Request) => (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id;

export const admissionChargeController = {

    async addActToAdmission(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const userId = getUserId(req) || null;
            const { admissionId } = req.params;
            const { globalActId, global_act_id, quantity } = req.body || {};
            const resolvedGlobalActId = globalActId || global_act_id;
            if (!resolvedGlobalActId) {
                return res.status(400).json({ error: 'globalActId requis' });
            }
            const data = await admissionChargeService.addActToAdmission({
                tenantId,
                admissionId,
                globalActId: resolvedGlobalActId,
                quantity: quantity != null ? Number(quantity) : 1,
                userId
            });
            res.status(201).json(data);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    },

    async listChargesForAdmission(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { admissionId } = req.params;
            const includeVoided = req.query.includeVoided === 'true';
            const data = await admissionChargeService.listCharges({ tenantId, admissionId, includeVoided });
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async voidChargeEvent(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const userId = getUserId(req) || null;
            const { chargeEventId } = req.params;
            const { reason } = req.body || {};
            const data = await admissionChargeService.voidCharge({
                tenantId,
                chargeEventId,
                userId,
                reason: reason || null
            });
            res.json(data);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    },

    async searchActs(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const q = (req.query.q as string) || '';
            const data = await admissionChargeService.searchActs(tenantId, q);
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
