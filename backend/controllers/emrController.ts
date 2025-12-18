
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
