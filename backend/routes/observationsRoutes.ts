import { Router } from 'express';
import { authenticateAnyToken } from '../middleware/authMiddleware';
import * as observationsController from '../controllers/observationsController';

const router = Router();

router.use(authenticateAnyToken);

router.get('/patient/:tenantPatientId', observationsController.listPatientObservations);
router.post('/', observationsController.createObservation);
router.patch('/:id', observationsController.updateDraftObservation);
router.post('/:id/sign', observationsController.signObservation);
router.post('/:id/addendum', observationsController.createAddendum);
router.post('/:id/entered-in-error', observationsController.enterObservationInError);

export default router;
