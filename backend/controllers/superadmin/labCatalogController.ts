import { Request, Response } from 'express';
import { labCatalogService } from '../../services/superadmin/labCatalogService';

export const listLabCatalog = async (req: Request, res: Response) => {
    try {
        const data = await labCatalogService.getAll(req.params.resource);
        res.json(data);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const createLabCatalog = async (req: Request, res: Response) => {
    try {
        const item = await labCatalogService.create(req.params.resource, req.body);
        res.status(201).json(item);
    } catch (err: any) {
        // Handle uniqueness strictly
        if (err.message.includes('existe déjà')) {
            return res.status(409).json({ error: err.message });
        }
        res.status(400).json({ error: err.message });
    }
};

export const updateLabCatalog = async (req: Request, res: Response) => {
    try {
        const item = await labCatalogService.update(req.params.resource, req.params.id, req.body);
        res.json(item);
    } catch (err: any) {
        if (err.message.includes('existe déjà')) {
            return res.status(409).json({ error: err.message });
        }
        res.status(400).json({ error: err.message });
    }
};

export const deactivateLabCatalog = async (req: Request, res: Response) => {
    try {
        const item = await labCatalogService.deactivate(req.params.resource, req.params.id);
        res.json(item);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const reactivateLabCatalog = async (req: Request, res: Response) => {
    try {
        const item = await labCatalogService.reactivate(req.params.resource, req.params.id);
        res.json(item);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

