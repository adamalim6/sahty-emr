
import { Request, Response } from 'express';
import { prescriptionService } from '../services/prescriptionService';
import { emrService } from '../services/emrService';
import { getTenantId } from '../middleware/authMiddleware';

export const prescriptionController = {
    // GET /api/prescriptions/:patientId
    getPrescriptionsByPatient: async (req: any, res: Response) => {
        try {
            const { patientId } = req.params;
            let tenantId;
            try {
                tenantId = getTenantId(req);
            } catch (err) {
                return res.status(403).json({ error: 'Tenant ID is required' });
            }

            const prescriptions = await prescriptionService.getPrescriptionsByPatient(tenantId, patientId);
            res.json(prescriptions);
        } catch (error) {
            console.error('getPrescriptionsByPatient Error:', error);
            res.status(500).json({ error: 'Failed to fetch prescriptions' });
        }
    },

    // POST /api/prescriptions/:patientId
    createPrescription: async (req: any, res: Response) => {
        try {
            const { patientId } = req.params;
            const prescriptionData = req.body;
            const clientId = req.user?.client_id; 
            const userId = req.user?.userId || 'unknown';
            const prenom = req.user?.prenom || '';
            const nom = req.user?.nom || '';
            let tenantId;
            try {
                tenantId = getTenantId(req);
            } catch (err) {
                return res.status(403).json({ error: 'Tenant ID is required' });
            }

            // Resolve or auto-create admission for this patient
            const admissionId = await emrService.resolveOrCreateAdmissionForPrescription(tenantId, patientId);

            const newPrescription = await prescriptionService.createPrescription(
                tenantId,
                patientId,
                admissionId,
                prescriptionData,
                userId,
                prenom || undefined,
                nom || undefined,
                clientId || undefined
            );

            res.status(201).json(newPrescription);
        } catch (error: any) {
            console.error('createPrescription Error:', error);
            res.status(500).json({ error: 'Failed to create prescription', details: error.message, stack: error.stack });
        }
    },

    // DELETE /api/prescriptions/:id
    deletePrescription: async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            let tenantId;
            try {
                tenantId = getTenantId(req);
            } catch (err) {
                return res.status(403).json({ error: 'Tenant ID is required' });
            }

            const deleted = await prescriptionService.deletePrescription(tenantId, id);

            if (deleted) {
                res.json({ success: true, message: 'Prescription deleted' });
            } else {
                res.status(404).json({ error: 'Prescription not found' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete prescription' });
        }
    },

    // GET /api/prescriptions/patients/with-prescriptions
    getPatientsWithPrescriptions: async (req: any, res: Response) => {
        try {
            let tenantId;
            try {
                tenantId = getTenantId(req);
            } catch (err) {
                return res.status(403).json({ error: 'Tenant ID is required' });
            }
            const patientsWithPrescriptions = await prescriptionService.getPatientsWithPrescriptions(tenantId);
            res.json(patientsWithPrescriptions);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch patients with prescriptions' });
        }
    },

    // POST /api/prescriptions/:id/pause
    pausePrescription: async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            const userId = req.user?.userId || 'unknown';
            let tenantId;
            try { tenantId = getTenantId(req); } catch { return res.status(403).json({ error: 'Tenant ID is required' }); }
            
            await prescriptionService.pausePrescription(tenantId, id, userId);
            res.json({ success: true, message: 'Prescription paused' });
        } catch (error: any) {
            res.status(400).json({ error: error.message || 'Failed to pause prescription' });
        }
    },

    // POST /api/prescriptions/:id/resume
    resumePrescription: async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            let tenantId;
            try { tenantId = getTenantId(req); } catch { return res.status(403).json({ error: 'Tenant ID is required' }); }
            
            await prescriptionService.resumePrescription(tenantId, id);
            res.json({ success: true, message: 'Prescription resumed' });
        } catch (error: any) {
            res.status(400).json({ error: error.message || 'Failed to resume prescription' });
        }
    },

    // POST /api/prescriptions/:id/stop
    stopPrescription: async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.user?.userId || 'unknown';
            let tenantId;
            try { tenantId = getTenantId(req); } catch { return res.status(403).json({ error: 'Tenant ID is required' }); }
            
            await prescriptionService.stopPrescription(tenantId, id, userId, reason);
            res.json({ success: true, message: 'Prescription stopped' });
        } catch (error: any) {
            res.status(400).json({ error: error.message || 'Failed to stop prescription' });
        }
    }
};
