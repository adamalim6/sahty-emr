import { Prescription, PrescriptionData } from '../models/prescription';
import { emrService } from './emrService';

// In-memory storage for prescriptions (will be lost on server restart)
const prescriptions: Prescription[] = [];

export const prescriptionService = {
    // Get all prescriptions for a specific patient
    getPrescriptionsByPatient: (patientId: string): Prescription[] => {
        return prescriptions.filter(p => p.patientId === patientId);
    },

    // Create a new prescription
    createPrescription: (patientId: string, data: PrescriptionData, createdBy: string = 'Current User'): Prescription => {
        const newPrescription: Prescription = {
            id: `PRESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId,
            data,
            createdAt: new Date(),
            createdBy
        };

        prescriptions.push(newPrescription);
        return newPrescription;
    },

    // Delete a prescription by ID
    deletePrescription: (id: string): boolean => {
        const index = prescriptions.findIndex(p => p.id === id);
        if (index !== -1) {
            prescriptions.splice(index, 1);
            return true;
        }
        return false;
    },

    // Get a single prescription by ID
    getPrescriptionById: (id: string): Prescription | undefined => {
        return prescriptions.find(p => p.id === id);
    },

    // Get all patients who have prescriptions with their info
    getPatientsWithPrescriptions: () => {
        // Get unique patient IDs from all prescriptions
        const patientIdsWithPrescriptions = [...new Set(prescriptions.map(p => p.patientId))];

        // Fetch patient data and combine with prescription count
        const patientsWithPrescriptions = patientIdsWithPrescriptions
            .map(patientId => {
                const patient = emrService.getPatientById(patientId);
                if (!patient) return null;

                const prescriptionCount = prescriptions.filter(p => p.patientId === patientId).length;

                return {
                    id: patient.id,
                    ipp: patient.ipp,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                    gender: patient.gender,
                    dateOfBirth: patient.dateOfBirth,
                    cin: patient.cin,
                    prescriptionCount
                };
            })
            .filter(p => p !== null);

        return patientsWithPrescriptions;
    }
};
