import { Request, Response } from 'express';
import { getTenantId } from '../middleware/authMiddleware';
import { externalSystemService } from '../services/externalSystemService';

export const externalSystemController = {

    // ── External Systems ─────────────────────────────────────────────

    async getSystems(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const systems = await externalSystemService.getAll(tenantId);
            res.json(systems);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    async createSystem(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { code, label, is_active } = req.body;
            if (!code || !label) return res.status(400).json({ error: 'code and label are required' });
            const result = await externalSystemService.create(tenantId, { code, label, is_active });
            res.status(201).json(result);
        } catch (err: any) {
            if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
                return res.status(409).json({ error: 'Un système avec ce code existe déjà' });
            }
            res.status(500).json({ error: err.message });
        }
    },

    async updateSystem(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { id } = req.params;
            const result = await externalSystemService.update(tenantId, id, req.body);
            res.json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    },

    async deleteSystem(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { id } = req.params;
            const result = await externalSystemService.delete(tenantId, id);
            res.json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    },

    // ── Global Act External Codes ────────────────────────────────────

    async getCodes(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { global_act_id, external_system_id } = req.query;
            const codes = await externalSystemService.getCodes(tenantId, {
                global_act_id: global_act_id as string | undefined,
                external_system_id: external_system_id as string | undefined,
            });
            res.json(codes);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    async createCode(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { global_act_id, external_system_id, external_code, is_active } = req.body;
            if (!global_act_id || !external_system_id || !external_code) {
                return res.status(400).json({ error: 'global_act_id, external_system_id and external_code are required' });
            }
            const result = await externalSystemService.createCode(tenantId, {
                global_act_id, external_system_id, external_code, is_active
            });
            res.status(201).json(result);
        } catch (err: any) {
            if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
                return res.status(409).json({ error: 'Ce mapping existe déjà' });
            }
            res.status(500).json({ error: err.message });
        }
    },

    async updateCode(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { id } = req.params;
            const result = await externalSystemService.updateCode(tenantId, id, req.body);
            res.json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    },

    async deleteCode(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { id } = req.params;
            const result = await externalSystemService.deleteCode(tenantId, id);
            res.json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message });
        }
    }
};
