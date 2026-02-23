
import { Router } from 'express';
import { prescriptionController } from '../controllers/prescriptionController';
import { getDispensationsByPrescription } from '../controllers/dispensationController';
import { prescriptionService } from '../services/prescriptionService';
import { authenticateToken, getTenantId } from '../middleware/authMiddleware';

const router = Router();

// Secure all routes
router.use(authenticateToken);

// Get all patients who have prescriptions (MUST be before /:patientId route)
router.get('/patients/with-prescriptions', prescriptionController.getPatientsWithPrescriptions);

// Get all prescriptions for a patient
router.get('/:patientId', prescriptionController.getPrescriptionsByPatient);

// Create a new prescription for a patient
router.post('/:patientId', prescriptionController.createPrescription);

// Delete a prescription
router.delete('/:id', prescriptionController.deletePrescription);

// Pause a prescription
router.post('/:id/pause', prescriptionController.pausePrescription);

// Resume a prescription
router.post('/:id/resume', prescriptionController.resumePrescription);

// Stop a prescription
router.post('/:id/stop', prescriptionController.stopPrescription);

// Get dispensations for a prescription
router.get('/:prescriptionId/dispensations', getDispensationsByPrescription);

// --- Prescription Execution Routes ---

// Record an execution
router.post('/:id/execute', async (req: any, res) => {
    try {
        const { id } = req.params;
        const executionData = req.body;
        let tenantId;
        try {
            tenantId = getTenantId(req);
        } catch (err) {
            return res.status(403).json({ error: 'Tenant ID is required' });
        }

        const result = await prescriptionService.recordExecution(tenantId, { ...executionData, prescriptionId: id });
        res.json(result);
    } catch (error) {
        console.error('Error recording execution:', error);
        res.status(500).json({ error: 'Failed to record execution' });
    }
});

// Get all executions for a prescription
router.get('/:id/executions', async (req: any, res) => {
    try {
        const { id } = req.params;
        let tenantId;
        try {
            tenantId = getTenantId(req);
        } catch (err) {
            return res.status(403).json({ error: 'Tenant ID is required' });
        }

        const executions = await prescriptionService.getExecutions(tenantId, id);
        res.json(executions);
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({ error: 'Failed to fetch executions' });
    }
});

// --- NEW: Explicit Administration Action Routes (Epic-like) ---

// Log an administration action for a specific event
router.post('/:id/events/:eventId/admin', async (req: any, res) => {
    try {
        const { eventId } = req.params;
        const { actionType, actualStartAt, actualEndAt, performedBy, performedByUserId, note } = req.body;
        let tenantId;
        try {
            tenantId = getTenantId(req);
        } catch (err) {
            return res.status(403).json({ error: 'Tenant ID is required' });
        }

        if (!actionType) {
            return res.status(400).json({ error: 'actionType is required' });
        }

        const result = await prescriptionService.logAdministrationAction(tenantId, eventId, actionType, {
            actualStartAt: actualStartAt ? new Date(actualStartAt) : undefined,
            actualEndAt: actualEndAt ? new Date(actualEndAt) : undefined,
            performedBy,
            performedByUserId,
            note
        });
        res.status(201).json(result);
    } catch (error) {
        console.error('Error logging administration action:', error);
        res.status(500).json({ error: 'Failed to log administration action' });
    }
});

// Get full administration history for a specific event
router.get('/:id/events/:eventId/admin', async (req: any, res) => {
    try {
        const { eventId } = req.params;
        let tenantId;
        try {
            tenantId = getTenantId(req);
        } catch (err) {
            return res.status(403).json({ error: 'Tenant ID is required' });
        }

        const history = await prescriptionService.getAdministrationHistory(tenantId, eventId);
        res.json(history);
    } catch (error) {
        console.error('Error fetching administration history:', error);
        res.status(500).json({ error: 'Failed to fetch administration history' });
    }
});

export default router;
