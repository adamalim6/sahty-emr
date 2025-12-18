
import { Request, Response } from 'express';
import { pharmacyService } from '../services/pharmacyService';

export const getInventory = (req: Request, res: Response) => {
    try {
        const inventory = pharmacyService.getInventory();
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching inventory' });
    }
};

export const getCatalog = (req: Request, res: Response) => {
    try {
        const catalog = pharmacyService.getCatalog();
        res.json(catalog);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching catalog' });
    }
};

export const getLocations = (req: Request, res: Response) => {
    try {
        const locations = pharmacyService.getLocations();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching locations' });
    }
};

export const getPartners = (req: Request, res: Response) => {
    try {
        const partners = pharmacyService.getPartners();
        res.json(partners);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching partners' });
    }
};

export const getStockOutSafety = (req: Request, res: Response) => {
    try {
        const history = pharmacyService.getStockOutHistory();
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock out history' });
    }
};
