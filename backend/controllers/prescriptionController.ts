
import { Request, Response } from 'express';
import { prescriptionService } from '../services/prescriptionService';

export const prescriptionController = {
    // GET /api/prescriptions/:patientId
    getPrescriptionsByPatient: (req: Request, res: Response) => {
        try {
            const { patientId } = req.params;
            const prescriptions = prescriptionService.getPrescriptionsByPatient(patientId);
            res.json(prescriptions);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch prescriptions' });
        }
    },

    // POST /api/prescriptions/:patientId
    createPrescription: (req: any, res: Response) => {
        try {
            const { patientId } = req.params;
            const prescriptionData = req.body;
            const clientId = req.user?.client_id; // From Auth Middleware
            const userName = req.user?.username || 'Unknown';

            const newPrescription = prescriptionService.createPrescription(
                patientId,
                prescriptionData,
                userName,
                clientId || undefined
            );

            res.status(201).json(newPrescription);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create prescription' });
        }
    },

    // DELETE /api/prescriptions/:id
    deletePrescription: (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const deleted = prescriptionService.deletePrescription(id);

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
            const clientId = req.user?.client_id;
            const patientsWithPrescriptions = await prescriptionService.getPatientsWithPrescriptions(clientId || undefined);
            res.json(patientsWithPrescriptions);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch patients with prescriptions' });
        }
    }
};
