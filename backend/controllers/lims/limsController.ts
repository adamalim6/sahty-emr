import { Request, Response } from 'express';
import { limsService } from '../../services/lims/limsService';

export const limsController = {
    // === CONTEXTS ===
    async getAnalyteContexts(req: Request, res: Response) {
        try { res.json(await limsService.getAnalyteContexts(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async createAnalyteContext(req: Request, res: Response) {
        try { res.status(201).json(await limsService.createAnalyteContext(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async updateAnalyteContext(req: Request, res: Response) {
        try { res.json(await limsService.updateAnalyteContext(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async setContextStatus(req: Request, res: Response) {
        try { res.json(await limsService.setContextStatus(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body.actif)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // === PROFILES ===
    async getReferenceProfiles(req: Request, res: Response) {
        try { res.json(await limsService.getReferenceProfiles(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async createReferenceProfile(req: Request, res: Response) {
        try { res.status(201).json(await limsService.createReferenceProfile(((req as any).auth?.tenantId || (req as any).user?.tenant_id), { ...req.body, analyte_context_id: req.params.id })); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async updateReferenceProfile(req: Request, res: Response) {
        try { res.json(await limsService.updateReferenceProfile(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async setProfileStatus(req: Request, res: Response) {
        try { res.json(await limsService.setProfileStatus(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body.actif)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // === RULES ===
    async getReferenceRules(req: Request, res: Response) {
        try { res.json(await limsService.getReferenceRules(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async createReferenceRule(req: Request, res: Response) {
        try { res.status(201).json(await limsService.createReferenceRule(((req as any).auth?.tenantId || (req as any).user?.tenant_id), { ...req.body, profile_id: req.params.id })); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async updateReferenceRule(req: Request, res: Response) {
        try { res.json(await limsService.updateReferenceRule(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async setRuleStatus(req: Request, res: Response) {
        try { res.json(await limsService.setRuleStatus(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body.actif)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // === TREES (SECTIONS & SUB-SECTIONS) ===
    async getSectionTree(req: Request, res: Response) {
        try { res.json(await limsService.getSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async createSectionTree(req: Request, res: Response) {
        try { res.status(201).json(await limsService.createSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async updateSectionTree(req: Request, res: Response) {
        try { res.json(await limsService.updateSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async setSectionTreeStatus(req: Request, res: Response) {
        try { res.json(await limsService.setSectionTreeStatus(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body.actif)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async getSubSectionTree(req: Request, res: Response) {
        try { res.json(await limsService.getSubSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async createSubSectionTree(req: Request, res: Response) {
        try { res.status(201).json(await limsService.createSubSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async updateSubSectionTree(req: Request, res: Response) {
        try { res.json(await limsService.updateSubSectionTree(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async setSubSectionTreeStatus(req: Request, res: Response) {
        try { res.json(await limsService.setSubSectionTreeStatus(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body.actif)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    // === ACTS ===
    async getBiologyActs(req: Request, res: Response) {
        try { res.json(await limsService.getBiologyActs(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getBiologyActDetails(req: Request, res: Response) {
        try { res.json(await limsService.getBiologyActDetails(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async assignActContext(req: Request, res: Response) {
        try { res.status(201).json(await limsService.assignActContext(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async unassignActContext(req: Request, res: Response) {
        try { res.json(await limsService.unassignActContext(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.assignmentId)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async assignActSpecimenContainer(req: Request, res: Response) {
        try { res.status(201).json(await limsService.assignActSpecimenContainer(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async unassignActSpecimenContainer(req: Request, res: Response) {
        try { res.json(await limsService.unassignActSpecimenContainer(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.assignmentId)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async assignActTaxonomy(req: Request, res: Response) {
        try { res.json(await limsService.assignActTaxonomy(((req as any).auth?.tenantId || (req as any).user?.tenant_id), req.params.id, req.body)); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },

    async getSousFamilles(req: Request, res: Response) {
        try { res.json(await limsService.getSousFamilles(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getSections(req: Request, res: Response) {
        try { res.json(await limsService.getSections(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getSubSections(req: Request, res: Response) {
        try { res.json(await limsService.getSubSections(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getAnalytes(req: Request, res: Response) {
        try { res.json(await limsService.getAnalytes(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getMethods(req: Request, res: Response) {
        try { res.json(await limsService.getMethods(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getSpecimenTypes(req: Request, res: Response) {
        try { res.json(await limsService.getSpecimenTypes(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getContainers(req: Request, res: Response) {
        try { res.json(await limsService.getContainers(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getSpecimenContainerTypes(req: Request, res: Response) {
        try { res.json(await limsService.getSpecimenContainerTypes(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    async getUnits(req: Request, res: Response) {
        try { res.json(await limsService.getUnits(((req as any).auth?.tenantId || (req as any).user?.tenant_id))); } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    },
    
    // === CANONICAL VALUES ===
    async getCanonicalValues(req: Request, res: Response) {
        try { 
            const domain = req.query.category as string | undefined;
            res.json(await limsService.getCanonicalValues(((req as any).auth?.tenantId || (req as any).user?.tenant_id), domain)); 
        } 
        catch (e: any) { res.status(400).json({ error: e.message }); }
    }
};
