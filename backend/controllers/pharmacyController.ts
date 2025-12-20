
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

export const createProduct = (req: Request, res: Response) => {
    try {
        const product = pharmacyService.addProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error creating product' });
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

export const createLocation = (req: Request, res: Response) => {
    try {
        const location = pharmacyService.addLocation(req.body);
        res.status(201).json(location);
    } catch (error) {
        res.status(500).json({ message: 'Error creating location' });
    }
};

export const updateLocation = (req: Request, res: Response) => {
    try {
        const location = req.body;
        // Ensure ID in body matches ID in params
        if (req.params.id && location.id !== req.params.id) {
            location.id = req.params.id;
        }
        const updated = pharmacyService.updateLocation(location);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating location' });
    }
};

export const deleteLocation = (req: Request, res: Response) => {
    try {
        pharmacyService.deleteLocation(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting location' });
    }
};

// Supplier Handlers
export const getSuppliers = (req: Request, res: Response) => {
    try {
        const suppliers = pharmacyService.getSuppliers();
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching suppliers' });
    }
};

export const createSupplier = (req: Request, res: Response) => {
    try {
        const supplier = pharmacyService.addSupplier(req.body);
        res.status(201).json(supplier);
    } catch (error) {
        res.status(500).json({ message: 'Error creating supplier' });
    }
};

export const updateSupplier = (req: Request, res: Response) => {
    try {
        const supplier = req.body;
        if (req.params.id && supplier.id !== req.params.id) {
            supplier.id = req.params.id;
        }
        const updated = pharmacyService.updateSupplier(supplier);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating supplier' });
    }
};

export const deleteSupplier = (req: Request, res: Response) => {
    try {
        pharmacyService.deleteSupplier(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting supplier' });
    }
};

// Product Updates

export const updateProduct = (req: Request, res: Response) => {
    try {
        const product = req.body;
        const updated = pharmacyService.updateProduct(product);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating product' });
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

// Workflow Endpoints

export const getPurchaseOrders = (req: Request, res: Response) => {
    try {
        const pos = pharmacyService.getPurchaseOrders();
        res.json(pos);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching POs' });
    }
};

export const createPurchaseOrder = (req: Request, res: Response) => {
    try {
        const po = pharmacyService.createPurchaseOrder(req.body);
        res.status(201).json(po);
    } catch (error) {
        res.status(500).json({ message: 'Error creating PO' });
    }
};

export const getDeliveryNotes = (req: Request, res: Response) => {
    try {
        const notes = pharmacyService.getDeliveryNotes();
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching deliveries' });
    }
};

export const createDeliveryNote = (req: Request, res: Response) => {
    try {
        const note = pharmacyService.createDeliveryNote(req.body);
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: 'Error creating delivery note' });
    }
};

export const processQuarantine = (req: Request, res: Response) => {
    try {
        const result = pharmacyService.processQuarantine(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error processing quarantine' });
    }
};
