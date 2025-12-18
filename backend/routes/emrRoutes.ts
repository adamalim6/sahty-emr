
import { Router } from 'express';
import { getPatients, getAdmissions, getAppointments, getRooms } from '../controllers/emrController';

const router = Router();

router.get('/patients', getPatients);
router.get('/admissions', getAdmissions);
router.get('/appointments', getAppointments);
router.get('/rooms', getRooms);

export default router;
