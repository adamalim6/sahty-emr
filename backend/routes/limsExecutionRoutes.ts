import { Router } from 'express';
import { limsExecutionController } from '../controllers/lims/limsExecutionController';
import * as emrController from '../controllers/emrController';

const router = Router();

// Lab Requests Batching
router.post('/lab-requests', limsExecutionController.submitLabRequests);

// Specimen Collection & Execution
router.get('/admissions/active-walkin-by-patient/:patientId', limsExecutionController.getActiveWalkinAdmission);
router.get('/admissions/:admissionId/collection-requirements', limsExecutionController.getCollectionRequirements);
router.post('/collections/prelever', limsExecutionController.executePrelevement);
router.post('/print-barcode', limsExecutionController.printBarcode);

// ICU Surveillance Engine 
router.get('/surveillance/biology-collection-candidates', limsExecutionController.getSurveillanceCandidates);
router.post('/surveillance/collections', limsExecutionController.executeSurveillanceCollection);

// Proxied EMR Functions (Authorized for LIMS Execution)
router.get('/patients/search', emrController.searchUniversalPatient);
router.post('/patients', emrController.createPatient);
router.get('/patients/:id', emrController.getPatient);
router.put('/patients/:id', emrController.updatePatient);
router.get('/coverages/search', emrController.searchCoverages);

router.get('/admissions', emrController.getAdmissions);
router.post('/admissions', emrController.createAdmission);
router.get('/admissions/by-patient/:patientId', emrController.getAdmissionsByPatient);

// Reference Data
router.get('/reference/organismes', emrController.getTenantOrganismes);
router.get('/reference/countries', emrController.getTenantCountries);
router.get('/reference/identity-document-types', emrController.getTenantIdentityDocumentTypes);

export default router;
