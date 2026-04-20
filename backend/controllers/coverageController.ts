import { Request, Response } from 'express';
import { coverageRepository } from '../repositories/coverageRepository';

const getTenantId = (req: Request) => (req as any).auth?.tenantId || (req as any).user?.tenant_id;
const getUserId = (req: Request) => (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id;

export const coverageController = {

    async list(req: Request, res: Response) {
        try {
            const data = await coverageRepository.listCoverages(getTenantId(req), {
                search: req.query.search as string,
                status: req.query.status as string
            });
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async getById(req: Request, res: Response) {
        try {
            const data = await coverageRepository.getCoverage(getTenantId(req), req.params.id);
            if (!data) return res.status(404).json({ error: 'Couverture introuvable' });
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async create(req: Request, res: Response) {
        try {
            const data = await coverageRepository.createCoverage(getTenantId(req), req.body, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async update(req: Request, res: Response) {
        try {
            const data = await coverageRepository.updateCoverage(getTenantId(req), req.params.id, req.body, getUserId(req));
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async addMember(req: Request, res: Response) {
        try {
            const data = await coverageRepository.addMember(getTenantId(req), req.params.id, req.body, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async updateMember(req: Request, res: Response) {
        try {
            const data = await coverageRepository.updateMember(getTenantId(req), req.params.memberId, req.body, getUserId(req));
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async removeMember(req: Request, res: Response) {
        try {
            const data = await coverageRepository.removeMember(getTenantId(req), req.params.memberId);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
};
