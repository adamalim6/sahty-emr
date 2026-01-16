import { Request, Response } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { AuthRequest, getTenantId } from '../middleware/authMiddleware';

export const dispenseWithFEFO = async (req: Request, res: Response) => {
    try {
        const { prescriptionId, admissionId, productId, mode, quantity, userId, targetPackIds } = req.body;

        // Validation
        if (!prescriptionId || !admissionId || !productId || !mode || !quantity || !userId) {
            return res.status(400).json({ message: 'Champs manquants' });
        }
        
        if (parseInt(quantity) <= 0) {
            return res.status(400).json({ message: 'La quantité doit être positive.' });
        }

        // Effectuer la dispensation
        // Note: PharmacyService throws errors for stock/validation issues which we catch below
        const tenantId = getTenantId(req as any);
        const dispensations = await pharmacyService.dispenseWithFEFO({
            tenantId,
            prescriptionId,
            admissionId,
            productId,
            mode,
            quantity: parseInt(quantity),
            userId,
            targetPackIds
        });

        res.status(201).json(dispensations);
    } catch (error: any) {
        console.error("Dispensation Error:", error);
        res.status(400).json({ message: error.message || 'Erreur lors de la dispensation' });
    }
};

export const getDispensationsByPrescription = (req: Request, res: Response) => {
    try {
        const { prescriptionId } = req.params;
        const tenantId = getTenantId(req as any);
        const dispensations = pharmacyService.getDispensationsByPrescription(tenantId, prescriptionId);
        res.json(dispensations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dispensations' });
    }
};

export const getDispensationsByAdmission = (req: Request, res: Response) => {
    try {
        const { admissionId } = req.params;
        const tenantId = getTenantId(req as any);
        const dispensations = pharmacyService.getDispensationsByAdmission(tenantId, admissionId);
        res.json(dispensations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dispensations' });
    }
};
