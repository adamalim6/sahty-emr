import { Router } from 'express';
import { limsReceptionController } from '../controllers/lims/limsReceptionController';

const router = Router();

// Barcode lookup
router.get('/specimens/:barcode', limsReceptionController.getSpecimenByBarcode);

// Receive specimen
router.post('/receive', limsReceptionController.receiveSpecimen);

// Reject specimen
router.post('/reject', limsReceptionController.rejectSpecimen);

// Mark insufficient
router.post('/insufficient', limsReceptionController.markInsufficient);

export default router;
