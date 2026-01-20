
import { Request, Response } from 'express';
import { globalProductService } from '../services/globalProductService';

export const getAllProducts = async (req: Request, res: Response) => {
    try {
        // Pagination Support
        if (req.query.page || req.query.limit) {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const q = (req.query.q as string) || '';
            
            const result = await globalProductService.getProductsPaginated(page, limit, q);
            return res.json(result);
        }

        const products = await globalProductService.getAllProducts();
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const product = await globalProductService.getProductById(req.params.id);
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
        const history = await globalProductService.getProductPriceHistory(req.params.id);
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
