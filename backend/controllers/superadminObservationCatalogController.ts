import { Request, Response } from 'express';
import { globalObservationCatalogService } from '../services/globalObservationCatalogService';

export const getFlowsheets = async (req: Request, res: Response) => {
    try {
        const flowsheets = await globalObservationCatalogService.getFlowsheets(true);
        res.json(flowsheets);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createFlowsheet = async (req: Request, res: Response) => {
    try {
        const { flowsheet, groupIds } = req.body;
        const created = await globalObservationCatalogService.createFlowsheet(flowsheet, groupIds);
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'uq_flowsheets_sort_order') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

export const updateFlowsheet = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { flowsheet, groupIds } = req.body;
        const updated = await globalObservationCatalogService.updateFlowsheet(id, flowsheet, groupIds);
        res.json(updated);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'uq_flowsheets_sort_order') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

export const getUnits = async (req: Request, res: Response) => {
    try {
        const units = await globalObservationCatalogService.getUnits();
        res.json(units);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createUnit = async (req: Request, res: Response) => {
    try {
        const created = await globalObservationCatalogService.createUnit(req.body);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateUnit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updated = await globalObservationCatalogService.updateUnit(id, req.body);
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getGroups = async (req: Request, res: Response) => {
    try {
        const groups = await globalObservationCatalogService.getGroups();
        res.json(groups);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const { group, parameterIds } = req.body;
        const created = await globalObservationCatalogService.createGroup(group, parameterIds);
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'uq_groups_sort_order') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { group, parameterIds } = req.body;
        const updated = await globalObservationCatalogService.updateGroup(id, group, parameterIds);
        res.json(updated);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'uq_groups_sort_order') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

export const getParameters = async (req: Request, res: Response) => {
    try {
        const parameters = await globalObservationCatalogService.getParameters();
        res.json(parameters);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createParameter = async (req: Request, res: Response) => {
    try {
        const created = await globalObservationCatalogService.createParameter(req.body);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateParameter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updated = await globalObservationCatalogService.updateParameter(id, req.body);
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getRoutes = async (req: Request, res: Response) => {
    try {
        const routes = await globalObservationCatalogService.getRoutes();
        res.json(routes);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createRoute = async (req: Request, res: Response) => {
    try {
        const created = await globalObservationCatalogService.createRoute(req.body);
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'idx_routes_sort_order_unique') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

export const updateRoute = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updated = await globalObservationCatalogService.updateRoute(id, req.body);
        res.json(updated);
    } catch (error: any) {
        if (error.code === '23505' && error.constraint === 'idx_routes_sort_order_unique') {
            return res.status(400).json({ message: "Le numéro d'ordre choisi est déja attribué." });
        }
        res.status(400).json({ message: error.message });
    }
};

