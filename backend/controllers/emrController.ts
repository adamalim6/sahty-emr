
import { Request, Response } from 'express';
import { emrService } from '../services/emrService';
import { getTenantId } from '../middleware/authMiddleware';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    return { tenantId, user: (req as any).user };
};

// GLOBAL (Patients)
export const getPatients = async (req: Request, res: Response) => {
    try {
        const patients = await emrService.getAllPatients();
        res.json(patients);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPatient = async (req: Request, res: Response) => {
    try {
        const patientData = req.body;
        const newPatient = await emrService.createPatient(patientData);
        res.status(201).json(newPatient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const updatedPatient = await emrService.updatePatient(id, updates);

        if (!updatedPatient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json(updatedPatient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getPatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const patient = await emrService.getPatientById(id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json(patient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// TENANT SCOPED (Admissions, Appointments, Rooms, Consumptions)

export const getAdmissions = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const admissions = await emrService.getAllAdmissions(tenantId);
        res.json(admissions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createAdmission = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const admissionData = { ...req.body }; 
        const newAdmission = await emrService.createAdmission(tenantId, admissionData);
        res.status(201).json(newAdmission);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const closeAdmission = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const admission = await emrService.closeAdmission(tenantId, id);

        if (!admission) {
            return res.status(404).json({ message: 'Admission not found' });
        }

        res.json(admission);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getAppointments = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const appointments = await emrService.getAllAppointments(tenantId);
        res.json(appointments);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getRooms = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const rooms = await emrService.getAllRooms(tenantId);
        res.json(rooms);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getConsumptionsByAdmission = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const consumptions = await emrService.getConsumptionsByAdmission(tenantId, id);
        res.json(consumptions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Legacy Location Endpoints removed (should use Pharmacy or Settings)
