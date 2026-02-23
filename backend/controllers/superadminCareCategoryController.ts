import { Request, Response } from 'express';
import { globalCareCategoryService } from '../services/globalCareCategoryService';

export const getCareCategories = async (req: Request, res: Response) => {
    try {
        const categories = await globalCareCategoryService.getCategories();
        res.json(categories);
    } catch (err: any) {
        console.error('Error fetching care categories:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const createCareCategory = async (req: Request, res: Response) => {
    try {
        const category = await globalCareCategoryService.createCategory(req.body);
        res.status(201).json(category);
    } catch (err: any) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Code validation conflict (must be unique)' });
        }
        console.error('Error creating care category:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

export const updateCareCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const category = await globalCareCategoryService.updateCategory(id, req.body);
        res.json(category);
    } catch (err: any) {
        if (err.message === 'Category not found') return res.status(404).json({ error: err.message });
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Code validation conflict (must be unique)' });
        }
        console.error('Error updating care category:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
