import { Router } from 'express';
import { getPatients, getAdmissions, getAppointments, getRooms, closeAdmission, createAdmission, createPatient, updatePatient, getPatient, getLocations, addLocation, updateLocation, deleteLocation, getConsumptionsByAdmission } from '../controllers/emrController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.get('/patients', getPatients);
router.get('/admissions', getAdmissions);
router.get('/appointments', getAppointments);
router.get('/rooms', getRooms);
router.put('/admissions/:id/close', closeAdmission);
router.get('/admissions/:id/consumptions', getConsumptionsByAdmission);

// Create new admission
router.post('/admissions', createAdmission);

// Create new patient
router.post('/patients', createPatient);

// Update patient
router.put('/patients/:id', updatePatient);

// Get single patient
router.get('/patients/:id', getPatient);

// Location Routes
router.get('/locations', getLocations);
router.post('/locations', addLocation);
router.put('/locations', updateLocation);
router.delete('/locations/:id', deleteLocation);

export default router;
