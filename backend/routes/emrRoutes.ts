import { Router } from 'express';
import { getPatients, getAdmissions, getAppointments, getRooms, closeAdmission, createAdmission, createPatient, updatePatient, getPatient, getConsumptionsByAdmission } from '../controllers/emrController';
import { getServiceStock, getUserServices } from '../controllers/serviceStockController';
import { authenticateToken, requireTenant } from '../middleware/authMiddleware';

const router = Router();

// Base Auth
router.use(authenticateToken);

// Service Stock - For nurses/clinical staff to view their department's stock
router.get('/service-stock', requireTenant, getServiceStock);
router.get('/user-services', requireTenant, getUserServices);

// GLOBAL: Patients (Shared Directory)
router.get('/patients', getPatients);
router.post('/patients', createPatient);
router.put('/patients/:id', updatePatient);
router.get('/patients/:id', getPatient);

// TENANT SCOPED: Admissions, Appointments, Rooms
// Apply strict tenant enforcement
router.use('/admissions', requireTenant);
router.use('/appointments', requireTenant);
router.use('/rooms', requireTenant);

router.get('/admissions', getAdmissions);
router.get('/appointments', getAppointments);
router.get('/rooms', getRooms);

router.put('/admissions/:id/close', closeAdmission);
router.get('/admissions/:id/consumptions', getConsumptionsByAdmission);

router.post('/admissions', createAdmission); // Uses tenant context

export default router;
