
import { Request, Response } from 'express';
import { globalProductService } from '../services/globalProductService';
import { referenceDataService } from '../services/referenceDataService';

export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const isTenantUser = tenantId && tenantId !== 'GLOBAL';

        // Pagination Support
        if (req.query.page || req.query.limit) {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const q = (req.query.q as string) || '';
            const idsFilter = req.query.ids ? (req.query.ids as string).split(',') : undefined;
            const dciId = req.query.dciId ? (req.query.dciId as string) : undefined;
            
            let result;
            if (isTenantUser) {
                result = await referenceDataService.getProductsPaginated(tenantId, page, limit, q, idsFilter, dciId);
            } else {
                result = await globalProductService.getProductsPaginated(page, limit, q, idsFilter);
            }
            return res.json(result);
        }

        let products;
        if (isTenantUser) {
             products = await referenceDataService.getAllProducts(tenantId);
        } else {
             products = await globalProductService.getAllProducts();
        }
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const isTenantUser = tenantId && tenantId !== 'GLOBAL';
        
        let product;
        if (isTenantUser) {
            product = await referenceDataService.getProductById(tenantId, req.params.id);
        } else {
            product = await globalProductService.getProductById(req.params.id);
        }

        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const product = await globalProductService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const product = await globalProductService.updateProduct(req.params.id, req.body);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        await globalProductService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


export const getProductPriceHistory = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenantId;
        const isTenantUser = tenantId && tenantId !== 'GLOBAL';
        
        let history;
        if (isTenantUser) {
             history = await referenceDataService.getProductPriceHistory(tenantId, req.params.id);
        } else {
             history = await globalProductService.getProductPriceHistory(req.params.id);
        }
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
