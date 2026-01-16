
import { Request, Response } from 'express';
import { globalProductService } from '../services/globalProductService';

export const getAllProducts = (req: Request, res: Response) => {
    try {
        const products = globalProductService.getAllProducts();
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getProductById = (req: Request, res: Response) => {
    try {
        const product = globalProductService.getProductById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createProduct = (req: Request, res: Response) => {
    try {
        const product = globalProductService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateProduct = (req: Request, res: Response) => {
    try {
        const product = globalProductService.updateProduct(req.params.id, req.body);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteProduct = (req: Request, res: Response) => {
    try {
        globalProductService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
