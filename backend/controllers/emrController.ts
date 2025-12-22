
import { Request, Response } from 'express';
import { emrService } from '../services/emrService';

export const getPatients = (req: Request, res: Response) => {
    try {
        const patients = emrService.getAllPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching patients' });
    }
};

export const getAdmissions = (req: Request, res: Response) => {
    try {
        const admissions = emrService.getAllAdmissions();
        res.json(admissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admissions' });
    }
};

export const getAppointments = (req: Request, res: Response) => {
    try {
        const appointments = emrService.getAllAppointments();
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

export const getRooms = (req: Request, res: Response) => {
    try {
        const rooms = emrService.getAllRooms();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rooms' });
    }
};

export const closeAdmission = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const admission = emrService.closeAdmission(id);

        if (!admission) {
            return res.status(404).json({ message: 'Admission not found' });
        }

        res.json(admission);
    } catch (error) {
        res.status(500).json({ message: 'Error closing admission' });
    }
};

export const createAdmission = (req: Request, res: Response) => {
    try {
        const admissionData = req.body;
        const newAdmission = emrService.createAdmission(admissionData);
        res.status(201).json(newAdmission);
    } catch (error) {
        res.status(500).json({ message: 'Error creating admission' });
    }
};

export const createPatient = (req: Request, res: Response) => {
    try {
        const patientData = req.body;
        const newPatient = emrService.createPatient(patientData);
        res.status(201).json(newPatient);
    } catch (error) {
        res.status(500).json({ message: 'Error creating patient' });
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
    } catch (error) {
        res.status(500).json({ message: 'Error updating patient' });
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
    } catch (error) {
        res.status(500).json({ message: 'Error fetching patient' });
    }
};

// Location Endpoints
export const getLocations = (req: Request, res: Response) => {
    try {
        const locations = emrService.getLocations();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching locations' });
    }
};

export const addLocation = (req: Request, res: Response) => {
    try {
        const location = req.body;
        const newLocation = emrService.addLocation(location);
        res.status(201).json(newLocation);
    } catch (error) {
        res.status(500).json({ message: 'Error adding location' });
    }
};

export const updateLocation = (req: Request, res: Response) => {
    try {
        const location = req.body;
        const updatedLocation = emrService.updateLocation(location);
        res.json(updatedLocation);
    } catch (error) {
        res.status(404).json({ message: 'Location not found' });
    }
};

export const deleteLocation = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        emrService.deleteLocation(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting location' });
    }
};
