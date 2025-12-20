import { Router } from 'express';
import { getPatients, getAdmissions, getAppointments, getRooms, closeAdmission, createAdmission, createPatient, updatePatient, getPatient } from '../controllers/emrController';

const router = Router();

router.get('/patients', getPatients);
router.get('/admissions', getAdmissions);
router.get('/appointments', getAppointments);
router.get('/rooms', getRooms);
router.put('/admissions/:id/close', closeAdmission);

// Create new admission
router.post('/admissions', createAdmission);

// Create new patient
router.post('/patients', createPatient);

// Update patient
router.put('/patients/:id', updatePatient);

// Get single patient
router.get('/patients/:id', getPatient);

export default router;
