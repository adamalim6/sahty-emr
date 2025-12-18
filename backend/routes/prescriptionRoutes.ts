import { Router } from 'express';
import { prescriptionController } from '../controllers/prescriptionController';

const router = Router();

// Get all patients who have prescriptions (MUST be before /:patientId route)
router.get('/patients/with-prescriptions', prescriptionController.getPatientsWithPrescriptions);

// Get all prescriptions for a patient
router.get('/:patientId', prescriptionController.getPrescriptionsByPatient);

// Create a new prescription for a patient
router.post('/:patientId', prescriptionController.createPrescription);

// Delete a prescription
router.delete('/:id', prescriptionController.deletePrescription);

export default router;
