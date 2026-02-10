
import { Request, Response } from 'express';
import { emrService } from '../services/emrService';
import { patientGlobalService } from '../services/patientGlobalService';
import { patientTenantService } from '../services/patientTenantService';
import { patientNetworkService } from '../services/patientNetworkService';
import { getTenantId } from '../middleware/authMiddleware';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    return { tenantId, user: (req as any).user };
};

// --- GLOBAL IDENTITY ---

export const searchGlobalPatient = async (req: Request, res: Response) => {
    try {
        const { documentNumber } = req.query;
        if (typeof documentNumber === 'string') {
            const result = await patientGlobalService.findByDocument(documentNumber);
            if (result) {
                return res.json(result);
            }
        }
        res.json(null); // Not found
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createGlobalPatient = async (req: Request, res: Response) => {
    try {
        const payload = req.body; // CreateGlobalPatientPayload
        const newGlobalPatient = await patientGlobalService.createIdentity(payload);
        res.status(201).json(newGlobalPatient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getGlobalConfig = async (req: Request, res: Response) => {
    try {
        const [docTypes, countries] = await Promise.all([
            patientGlobalService.getDocumentTypes(),
            patientGlobalService.getCountries()
        ]);
        res.json({ docTypes, countries });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// --- TENANT PATIENTS ---

export const getPatients = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        // This is now "Get Tenant Patients List"
        const patients = await patientTenantService.getAllTenantPatients(tenantId);
        res.json(patients);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getPatient = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params; // tenantPatientId
        const patient = await patientTenantService.getTenantPatient(tenantId, id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found in tenant' });
        }

        res.json(patient);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPatient = async (req: Request, res: Response) => {
    // This is now "Register Tenant Patient"
    // Expects CreateTenantPatientPayload
    try {
        const { tenantId } = getContext(req);
        const payload = req.body;
        const tenantPatientId = await patientTenantService.createTenantPatient(tenantId, payload);
        res.status(201).json({ tenantPatientId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePatient = async (req: Request, res: Response) => {
    // Legacy update - deprecated or needs specific update logic (e.g. add info)
    res.status(501).json({ message: "Update Patient not implemented in new architecture yet" });
};


// --- PATIENT NETWORK (Relationships, etc.) ---

export const getPatientNetwork = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params; // tenantPatientId
        const network = await patientNetworkService.getNetwork(tenantId, id);
        res.json(network);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const addRelationship = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params; // subjectPatientId
        const payload = { ...req.body, subjectPatientId: id };
        const relId = await patientNetworkService.addRelationship(tenantId, payload);
        res.status(201).json({ relationshipId: relId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const addEmergencyContact = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params; // tenantPatientId
        const payload = { ...req.body, tenantPatientId: id };
        const contactId = await patientNetworkService.addEmergencyContact(tenantId, payload);
        res.status(201).json({ emergencyContactId: contactId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPerson = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const payload = req.body;
        const personId = await patientNetworkService.createPerson(tenantId, payload);
        res.status(201).json({ personId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


// --- CHART MERGE ---

export const getDuplicateCharts = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const groups = await patientTenantService.findDuplicateCharts(tenantId);
        res.json(groups);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const mergePatientCharts = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const { sourceId, targetId, reason } = req.body;

        if (!sourceId || !targetId) {
            return res.status(400).json({ message: 'sourceId and targetId are required' });
        }
        if (sourceId === targetId) {
            return res.status(400).json({ message: 'Source and target must be different charts' });
        }

        const event = await patientTenantService.mergeTenantPatients(
            tenantId, sourceId, targetId, reason, user?.id
        );
        res.status(200).json(event);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getPatientMergeHistory = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const history = await patientTenantService.getMergeHistory(tenantId, id);
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


// --- TENANT SCOPED (Admissions, Appointments, Rooms, Consumptions) ---

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

import { placementService } from '../services/placementService';

export const getRooms = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const rooms = await placementService.getAllRooms(tenantId);
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
