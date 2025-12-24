import { Router } from 'express';
import { prescriptionController } from '../controllers/prescriptionController';
import { getDispensationsByPrescription } from '../controllers/dispensationController';
import { prescriptionService } from '../services/prescriptionService';

const router = Router();

// Get all patients who have prescriptions (MUST be before /:patientId route)
router.get('/patients/with-prescriptions', prescriptionController.getPatientsWithPrescriptions);

// Get all prescriptions for a patient
router.get('/:patientId', prescriptionController.getPrescriptionsByPatient);

// Create a new prescription for a patient
router.post('/:patientId', prescriptionController.createPrescription);

// Delete a prescription
router.delete('/:id', prescriptionController.deletePrescription);

// Get dispensations for a prescription
router.get('/:prescriptionId/dispensations', getDispensationsByPrescription);

// --- Prescription Execution Routes ---

// Record an execution
router.post('/:id/execute', (req, res) => {
    try {
        const { id } = req.params;
        const executionData = req.body;
        // Ensure prescriptionId matches path param
        const result = prescriptionService.recordExecution({ ...executionData, prescriptionId: id });
        res.json(result);
    } catch (error) {
        console.error('Error recording execution:', error);
        res.status(500).json({ error: 'Failed to record execution' });
    }
});

// Get all executions for a prescription
router.get('/:id/executions', (req, res) => {
    try {
        const { id } = req.params;
        const executions = prescriptionService.getExecutions(id);
        res.json(executions);
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({ error: 'Failed to fetch executions' });
    }
});

export default router;
