
import { Router } from 'express';
import { dispenseWithFEFO, getDispensationsByPrescription } from '../controllers/dispensationController';

const router = Router();

router.post('/dispensations/fefo', dispenseWithFEFO);
router.get('/dispensations/prescription/:prescriptionId', getDispensationsByPrescription);

export default router;
