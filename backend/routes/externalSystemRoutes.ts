import { Router } from 'express';
import { externalSystemController } from '../controllers/externalSystemController';

const router = Router();

// External Systems
router.get('/external-systems', externalSystemController.getSystems);
router.post('/external-systems', externalSystemController.createSystem);
router.patch('/external-systems/:id', externalSystemController.updateSystem);
router.delete('/external-systems/:id', externalSystemController.deleteSystem);

// Global Act External Codes
router.get('/global-act-external-codes', externalSystemController.getCodes);
router.post('/global-act-external-codes', externalSystemController.createCode);
router.patch('/global-act-external-codes/:id', externalSystemController.updateCode);
router.delete('/global-act-external-codes/:id', externalSystemController.deleteCode);

export default router;
