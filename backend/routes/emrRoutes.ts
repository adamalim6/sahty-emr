import { Router } from 'express';
import { 
    getPatients, 
    getAdmissions, 
    getAppointments, 
    getRooms, 
    closeAdmission, 
    createAdmission, 
    createPatient, // Now Tenant Register
    updatePatient, 
    getPatient, 
    getConsumptionsByAdmission,
    // New Global Endpoints
    searchGlobalPatient,
    createGlobalPatient,
    getGlobalConfig,
    // Patient Network
    getPatientNetwork,
    addRelationship,
    addEmergencyContact,
    createPerson,
    // Chart Merge
    getDuplicateCharts,
    mergePatientCharts,
    getPatientMergeHistory
} from '../controllers/emrController';

import { getServiceStock, getUserServices } from '../controllers/serviceStockController';
import { createReturn, getReturns, getReturnDetails } from '../controllers/stockReturnController';
import { authenticateToken, requireTenant } from '../middleware/authMiddleware';

const router = Router();

// Base Auth
router.use(authenticateToken);

// Service Stock
router.get('/service-stock', requireTenant, getServiceStock);
router.get('/user-services', requireTenant, getUserServices);

// Returns
router.post('/returns', requireTenant, createReturn);
router.get('/returns', requireTenant, getReturns);
router.get('/returns/:id', requireTenant, getReturnDetails);

// --- GLOBAL PATIENTS (Identity) ---
// No requireTenant for purely global lookups? Or maybe yes for security context?
// Usually EMR actions are within a tenant context.
router.get('/global/search', requireTenant, searchGlobalPatient);
router.post('/global', requireTenant, createGlobalPatient);
router.get('/config', requireTenant, getGlobalConfig); // For doc types, countries

// --- TENANT PATIENTS (Linkage) ---
// "Get Patients" = Get Tenant Patient List (ACTIVE only)
router.get('/patients', requireTenant, getPatients);

// "Create Patient" = Register Tenant Patient Link
router.post('/patients', requireTenant, createPatient);

// --- CHART MERGE (must be before /patients/:id to avoid route conflict) ---
router.get('/patients/duplicates', requireTenant, getDuplicateCharts);
router.post('/patients/merge', requireTenant, mergePatientCharts);

// Update Tenant Patient (e.g. status)
router.put('/patients/:id', requireTenant, updatePatient);

// Get Tenant Patient Detail (resolves merge chains automatically)
router.get('/patients/:id', requireTenant, getPatient);

// Merge history for a chart
router.get('/patients/:id/merge-history', requireTenant, getPatientMergeHistory);

// --- PATIENT NETWORK ---
router.get('/patients/:id/network', requireTenant, getPatientNetwork);
router.post('/patients/:id/relationships', requireTenant, addRelationship);
router.post('/patients/:id/emergency-contacts', requireTenant, addEmergencyContact);
router.post('/persons', requireTenant, createPerson);


// --- CLINICAL WORKFLOWS ---
router.use('/admissions', requireTenant);
router.use('/appointments', requireTenant);
router.use('/rooms', requireTenant);

router.get('/admissions', getAdmissions);
router.get('/appointments', getAppointments);
router.get('/rooms', getRooms);

router.put('/admissions/:id/close', closeAdmission);
router.get('/admissions/:id/consumptions', getConsumptionsByAdmission);

router.post('/admissions', createAdmission);

export default router;
