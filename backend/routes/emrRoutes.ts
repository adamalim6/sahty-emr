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
    getPatientChangeHistory,
    getAdmissionsByPatient,
    getConsumptionsByAdmission,
    // New Global Endpoints
    searchGlobalPatient,
    createGlobalPatient,
    getGlobalConfig,
    // Universal Access
    searchUniversalPatient,
    // importGlobalPatient removed
    // Patient Network
    getPatientNetwork,
    addRelationship,
    addEmergencyContact,
    createPerson,
    // Chart Merge
    getDuplicateCharts,
    mergePatientCharts,
    getPatientMergeHistory,
    getTenantOrganismes,
    getTenantCountries,
    getTenantCareCategories,
    getTenantIdentityDocumentTypes,
    searchCoverages,
    getHospitalServices,
    getHospitalDoctors,
    getServiceBedOccupancy
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

// --- REFERENCE DATA (TENANT) ---
router.get('/reference/organismes', requireTenant, getTenantOrganismes);
router.get('/reference/countries', requireTenant, getTenantCountries);
router.get('/reference/care-categories', requireTenant, getTenantCareCategories);
router.get('/reference/identity-document-types', requireTenant, getTenantIdentityDocumentTypes);
router.get('/hospital/services', requireTenant, getHospitalServices);
router.get('/hospital/doctors', requireTenant, getHospitalDoctors);
router.get('/services/:serviceId/occupancy', requireTenant, getServiceBedOccupancy);

// --- COVERAGES ---
router.get('/coverages/search', requireTenant, searchCoverages);

// --- TENANT PATIENTS (Linkage) ---
// "Get Patients" = Get Tenant Patient List (ACTIVE only)
router.get('/patients', requireTenant, getPatients);

// --- CHARTS & REGISTRATION ---

// Universal Search (Local -> Global)
router.get('/patients/universal-search', requireTenant, searchUniversalPatient);

// Import Global Patient to Local - REMOVED (Legacy)
// router.post('/patients/import', requireTenant, importGlobalPatient);

// "Create Patient" = Register New Tenant Patient
router.post('/patients', requireTenant, createPatient);

// --- CHART MERGE (must be before /patients/:id to avoid route conflict) ---
router.get('/patients/duplicates', requireTenant, getDuplicateCharts);
router.post('/patients/merge', requireTenant, mergePatientCharts);

// Update Tenant Patient (e.g. status)
router.put('/patients/:id', requireTenant, updatePatient);

// Get Tenant Patient Detail (resolves merge chains automatically)
router.get('/patients/:id', requireTenant, getPatient);

// Merge history for a chart
router.get('/patients/:id/change-history', requireTenant, getPatientChangeHistory);
router.get('/patients/:patientId/admissions', requireTenant, getAdmissionsByPatient);
router.get('/patients/:id/merge-history', requireTenant, getPatientMergeHistory);

// --- PATIENT NETWORK ---
router.get('/patients/:id/network', requireTenant, getPatientNetwork);
router.post('/patients/:id/relationships', requireTenant, addRelationship);
router.post('/patients/:id/emergency-contacts', requireTenant, addEmergencyContact);
router.post('/persons', requireTenant, createPerson);


import { getAdmissionStays, assignBed, transferBed } from '../controllers/placementController';

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

// --- ADMISSION STAYS & TRANSFERS ---
router.get('/admissions/:admissionId/stays', requireTenant, getAdmissionStays);
router.post('/admissions/:admissionId/stays', requireTenant, assignBed);
router.post('/admissions/:admissionId/transfer', requireTenant, transferBed);

import { getSurveillanceTimeline, updateSurveillanceCell } from '../controllers/surveillanceController';
import { getDiagnoses, createDiagnosis, resolveDiagnosis, voidDiagnosis, reactivateDiagnosis } from '../controllers/diagnosisController';

// --- MEDICAL DOSSIER / DIAGNOSES ---
router.get('/patients/:tenantPatientId/diagnoses', requireTenant, getDiagnoses);
router.post('/patients/:tenantPatientId/diagnoses', requireTenant, createDiagnosis);
router.patch('/diagnoses/:id/resolve', requireTenant, resolveDiagnosis);
router.patch('/diagnoses/:id/void', requireTenant, voidDiagnosis);
router.patch('/diagnoses/:id/reactivate', requireTenant, reactivateDiagnosis);

// --- SURVEILLANCE / MAR ---
router.get('/patients/:patientId/surveillance/timeline', requireTenant, getSurveillanceTimeline);
router.post('/patients/:patientId/surveillance/cell', requireTenant, updateSurveillanceCell);

import { listBloodBags, createBloodBag, discardBloodBag, getTimeline as getTransfusionTimeline } from '../controllers/transfusionController';

// ----------------------------------------------------------------------
// Transfusion Routes
// ----------------------------------------------------------------------
router.get('/patients/:tenantPatientId/transfusions/bags', requireTenant, listBloodBags);
router.post('/patients/:tenantPatientId/transfusions/bags', requireTenant, createBloodBag);
router.post('/transfusions/bags/:id/discard', requireTenant, discardBloodBag);
router.get('/patients/:tenantPatientId/transfusions/timeline', requireTenant, getTransfusionTimeline);

// --- ADMISSION CHARGES (Billing / Charge-Router foundation) ---
import { admissionChargeController } from '../controllers/admissionChargeController';

router.get('/acts/search', requireTenant, admissionChargeController.searchActs);
router.post('/admissions/:admissionId/acts', requireTenant, admissionChargeController.addActToAdmission);
router.get('/admissions/:admissionId/charges', requireTenant, admissionChargeController.listChargesForAdmission);
router.post('/admission-charges/:chargeEventId/void', requireTenant, admissionChargeController.voidChargeEvent);

// --- COVERAGES (patient-level policy registry) ---
import { coverageController } from '../controllers/coverageController';

router.get('/coverages', requireTenant, coverageController.list);
router.post('/coverages', requireTenant, coverageController.create);
router.get('/coverages/:id', requireTenant, coverageController.getById);
router.put('/coverages/:id', requireTenant, coverageController.update);
router.post('/coverages/:id/members', requireTenant, coverageController.addMember);
router.put('/coverages/members/:memberId', requireTenant, coverageController.updateMember);
router.delete('/coverages/members/:memberId', requireTenant, coverageController.removeMember);

// --- ECG & Echo ---
import { listECGs, createECG, updateECG, deleteECG, enterECGInError, listEchos, createEcho, updateEcho, deleteEcho, enterEchoInError } from '../controllers/ecgEchoController';

router.get('/patients/:patientId/ecg',                   requireTenant, listECGs);
router.post('/patients/:patientId/ecg',                  requireTenant, createECG);
router.put('/patients/:patientId/ecg/:ecgId',            requireTenant, updateECG);
router.delete('/patients/:patientId/ecg/:ecgId',         requireTenant, deleteECG);
router.post('/patients/:patientId/ecg/:ecgId/entered-in-error', requireTenant, enterECGInError);

router.get('/patients/:patientId/echo',                    requireTenant, listEchos);
router.post('/patients/:patientId/echo',                   requireTenant, createEcho);
router.put('/patients/:patientId/echo/:echoId',            requireTenant, updateEcho);
router.delete('/patients/:patientId/echo/:echoId',         requireTenant, deleteEcho);
router.post('/patients/:patientId/echo/:echoId/entered-in-error', requireTenant, enterEchoInError);

export default router;
