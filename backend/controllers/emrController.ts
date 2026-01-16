
import { Request, Response } from 'express';
import { emrService } from '../services/emrService';
import { getTenantId } from '../middleware/authMiddleware';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    return { tenantId, user: (req as any).user };
};

// GLOBAL (Patients)
export const getPatients = (req: Request, res: Response) => {
    try {
        // Patients are Global, but we require auth (handled by middleware)
        const patients = emrService.getAllPatients();
        res.json(patients);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPatient = (req: Request, res: Response) => {
    try {
        const patientData = req.body;
        const newPatient = emrService.createPatient(patientData);
        res.status(201).json(newPatient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePatient = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedPatient = emrService.updatePatient(id, updates);

        if (!updatedPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json(updatedPatient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getPatient = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const patient = emrService.getPatientById(id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json(patient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// TENANT SCOPED (Admissions, Appointments, Rooms, Consumptions)

export const getAdmissions = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const admissions = emrService.getAllAdmissions(tenantId);
        res.json(admissions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createAdmission = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const admissionData = { ...req.body }; // tenantId injected by service or we pass it
        const newAdmission = emrService.createAdmission(tenantId, admissionData);
        res.status(201).json(newAdmission);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const closeAdmission = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const admission = emrService.closeAdmission(tenantId, id);

        if (!admission) {
            return res.status(404).json({ message: 'Admission not found' });
        }

        res.json(admission);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAppointments = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const appointments = emrService.getAllAppointments(tenantId);
        res.json(appointments);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getRooms = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const rooms = emrService.getAllRooms(tenantId);
        res.json(rooms);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getConsumptionsByAdmission = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const consumptions = emrService.getConsumptionsByAdmission(tenantId, id);
        res.json(consumptions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Legacy Location Endpoints removed (should use Pharmacy or Settings)
