import { Router } from 'express';
import { addictionsController } from '../controllers/addictionsController';

const router = Router();

router.get('/patient/:tenant_patient_id', addictionsController.listPatientAddictions);
router.post('/', addictionsController.createAddiction);
router.patch('/:id', addictionsController.updateAddiction);
router.patch('/:id/status', addictionsController.updateAddictionStatus);
router.get('/:id/history', addictionsController.getAddictionHistory);
router.post('/:id/observations', addictionsController.createAddictionObservation);

export default router;
