
import { Request, Response } from 'express';
import { globalDCIService } from '../services/GlobalDCIService';

export const getAllDCIs = (req: Request, res: Response) => {
    try {
        const dcis = globalDCIService.getAllDCIs();
        res.json(dcis);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createDCI = (req: Request, res: Response) => {
    try {
        const dci = globalDCIService.createDCI(req.body);
        res.status(201).json(dci);
    } catch (error: any) {
        if (error.message.includes('existe déjà')) {
             res.status(409).json({ message: error.message });
        } else {
             res.status(400).json({ message: error.message });
        }
    }
};

export const updateDCI = (req: Request, res: Response) => {
    try {
        const dci = globalDCIService.updateDCI(req.params.id, req.body);
        res.json(dci);
    } catch (error: any) {
         if (error.message.includes('existe déjà')) {
             res.status(409).json({ message: error.message });
        } else if (error.message === 'DCI non trouvée') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(400).json({ message: error.message });
        }
    }
};

export const deleteDCI = (req: Request, res: Response) => {
    try {
        globalDCIService.deleteDCI(req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
