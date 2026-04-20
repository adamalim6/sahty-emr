import { Request, Response } from 'express';
import { pricingListRepository } from '../repositories/pricingListRepository';

const getTenantId = (req: Request) => (req as any).auth?.tenantId || (req as any).user?.tenant_id;
const getUserId = (req: Request) => (req as any).auth?.userId || (req as any).user?.userId || (req as any).user?.id;

export const pricingListController = {

    // --- PRICING LISTS ---
    async list(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.listPricingLists(getTenantId(req), {
                search: req.query.search as string,
                status: req.query.status as string
            });
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async getById(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.getPricingList(getTenantId(req), req.params.id);
            if (!data) return res.status(404).json({ error: 'Grille tarifaire introuvable' });
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async create(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.createPricingList(getTenantId(req), req.body, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async update(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.updatePricingList(getTenantId(req), req.params.id, req.body);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async publish(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.publishPricingList(getTenantId(req), req.params.id, getUserId(req));
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async archive(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.archivePricingList(getTenantId(req), req.params.id);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async duplicate(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.duplicatePricingList(getTenantId(req), req.params.id, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // --- ITEMS ---
    async listItems(req: Request, res: Response) {
        try {
            const showRemoved = req.query.showRemoved === 'true';
            const data = await pricingListRepository.listItems(getTenantId(req), req.params.id, showRemoved);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async addItem(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.addItem(getTenantId(req), req.params.id, req.body.global_act_id, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async removeItem(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.removeItem(getTenantId(req), req.params.itemId, getUserId(req), req.body.reason);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async reactivateItem(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.reactivateItem(getTenantId(req), req.params.itemId);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // --- ITEM VERSIONS ---
    async getItemVersions(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.getItemVersions(getTenantId(req), req.params.itemId);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async createItemVersion(req: Request, res: Response) {
        try {
            if (req.body.unit_price == null || req.body.unit_price < 0) return res.status(400).json({ error: 'Prix unitaire invalide' });
            const data = await pricingListRepository.createItemVersion(getTenantId(req), req.params.itemId, req.body, getUserId(req));
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async updateDraftVersion(req: Request, res: Response) {
        try {
            if (req.body.unit_price == null || req.body.unit_price < 0) return res.status(400).json({ error: 'Prix unitaire invalide' });
            const data = await pricingListRepository.updateDraftVersion(getTenantId(req), req.params.versionId, req.body);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async publishItemVersion(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.publishItemVersion(getTenantId(req), req.params.versionId, getUserId(req));
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // --- ORGANISMES ---
    async listOrganismes(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.listOrganismes(getTenantId(req), req.params.id);
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async assignOrganisme(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.assignOrganisme(getTenantId(req), req.params.id, req.body.organisme_id, getUserId(req), req.body);
            res.status(201).json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async removeOrganisme(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.removeOrganisme(getTenantId(req), req.params.assignmentId, getUserId(req), req.body.reason);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async reactivateOrganisme(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.reactivateOrganisme(getTenantId(req), req.params.assignmentId);
            res.json(data);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // --- DICTIONARIES ---
    async searchActes(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.searchGlobalActes(getTenantId(req), (req.query.q as string) || '');
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    },

    async listAvailableOrganismes(req: Request, res: Response) {
        try {
            const data = await pricingListRepository.listOrganismesForSelect(getTenantId(req));
            res.json(data);
        } catch (e: any) { res.status(500).json({ error: e.message }); }
    }
};
