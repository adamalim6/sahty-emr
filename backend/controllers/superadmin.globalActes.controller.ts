import { Request, Response } from 'express';
import { globalActesService } from '../services/globalActesService';

export const getGlobalActes = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const search = req.query.search as string;

        const result = await globalActesService.getAllPaginated(page, limit, search);
        
        res.json({
            data: result.data,
            total: result.total,
            page,
            totalPages: Math.ceil(result.total / limit)
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createGlobalActe = async (req: Request, res: Response) => {
    try {
        const acte = await globalActesService.createActe(req.body);
        res.status(201).json(acte);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const updateGlobalActe = async (req: Request, res: Response) => {
    try {
        const acte = await globalActesService.updateActe(req.params.id, req.body);
        res.json(acte);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const deleteGlobalActe = async (req: Request, res: Response) => {
    try {
        await globalActesService.deleteActe(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

// --- Familles ---
export const getFamilles = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.getFamilles();
        res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createFamille = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.createFamille(req.body);
        res.status(201).json(data);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const updateFamille = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.updateFamille(req.params.id, req.body);
        res.json(data);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const deleteFamille = async (req: Request, res: Response) => {
    try {
        await globalActesService.deleteFamille(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};

// --- Sous-Familles ---
export const getSousFamilles = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.getSousFamilles();
        res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createSousFamille = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.createSousFamille(req.body);
        res.status(201).json(data);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const updateSousFamille = async (req: Request, res: Response) => {
    try {
        const data = await globalActesService.updateSousFamille(req.params.id, req.body);
        res.json(data);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};

export const deleteSousFamille = async (req: Request, res: Response) => {
    try {
        await globalActesService.deleteSousFamille(req.params.id);
        res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
};
