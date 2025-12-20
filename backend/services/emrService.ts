
import { Patient, Admission, Appointment, Room, Gender, UserSettings } from '../models/emr';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'emr_db.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class EmrService {
    private patients: Patient[] = [];
    private admissions: Admission[] = [];
    private appointments: Appointment[] = [];
    private rooms: Room[] = [];

    constructor() {
        this.loadData();
        if (this.patients.length === 0) {
            // this.initializeMockData(); // Disabled for manual entry
        }
        if (this.rooms.length === 0) {
            // ensure rooms are persisted if needed, or leave empty. 
            // Actually, the user wants EMPTY. But rooms are usually structural. 
            // Let's verify if rooms appearing in the screenshot are desired. 
            // "vide toute la data"... usually implies patient data. 
            // But the user said "vide toute la data". 
            // I will mock rooms initialization.
        }
    }

    private loadData() {
        if (fs.existsSync(DB_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                this.patients = data.patients || [];
                this.admissions = data.admissions || [];
                this.appointments = data.appointments || [];
                if (data.rooms && data.rooms.length > 0) this.rooms = data.rooms;
            } catch (error) {
                console.error("Failed to load EMR DB", error);
            }
        }
    }

    private saveData() {
        const data = {
            patients: this.patients,
            admissions: this.admissions,
            appointments: this.appointments,
            rooms: this.rooms
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    private initializeMockData() {
        // Mock Patient
        const patient: Patient = {
            id: 'PAT-001',
            firstName: 'Adam',
            lastName: 'Alimi',
            dateOfBirth: '1995-05-15',
            gender: Gender.Male,
            isProvisional: false,
            ipp: 'IPP-123456',
            address: '123 Rue Principale, Casablanca',
            phone: '+212 6 00 00 00 00',
            cin: 'BE123456',
            isPayant: false
        };
        this.patients.push(patient);

        // Mock Admission
        const admission: Admission = {
            id: 'ADM-001',
            patientId: 'PAT-001',
            nda: 'NDA-001',
            reason: 'Hypertension',
            admissionDate: new Date().toISOString(),
            status: 'En cours',
            service: 'Cardiologie',
            roomNumber: '101',
            doctorName: 'Dr. S. Alami',
            type: 'Urgence'
        };
        this.admissions.push(admission);

        // Mark room as occupied
        const room = this.rooms.find(r => r.number === '101');
        if (room) room.isOccupied = true;

        this.saveData();
    }

    getAllPatients(): Patient[] {
        return this.patients;
    }

    getPatientById(id: string): Patient | undefined {
        return this.patients.find(p => p.id === id);
    }

    getAllAdmissions(): Admission[] {
        return this.admissions;
    }

    getAllAppointments(): Appointment[] {
        return this.appointments;
    }

    getAllRooms(): Room[] {
        return this.rooms;
    }

    closeAdmission(id: string): Admission | null {
        const admission = this.admissions.find(a => a.id === id);
        if (!admission) {
            return null;
        }

        admission.status = 'Sorti';
        admission.dischargeDate = new Date().toISOString();

        // Free up the bed/room logic
        if (admission.roomNumber) {
            const room = this.rooms.find(r => r.number === admission.roomNumber);
            if (room) {
                room.isOccupied = false;
                this.saveData(); // Save room status
            }
        }
        this.saveData();

        return admission;
    }

    createAdmission(data: Admission): Admission {
        const newAdmission = { ...data };
        this.admissions.push(newAdmission);

        // Occupy room
        if (newAdmission.roomNumber) {
            const room = this.rooms.find(r => r.number === newAdmission.roomNumber);
            if (room) {
                room.isOccupied = true;
            }
        }

        this.saveData();
        return newAdmission;
    }

    createPatient(data: Partial<Patient>): Patient {
        const newPatient: Patient = {
            id: (this.patients.length + 1 + Math.floor(Math.random() * 10000)).toString(),
            isProvisional: false,
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            gender: Gender.Male,
            ipp: `IPP-${Math.floor(Math.random() * 1000000)}`,
            ...data
        } as Patient;
        this.patients.push(newPatient);
        this.saveData();
        return newPatient;
    }

    updatePatient(id: string, data: Partial<Patient>): Patient | null {
        const index = this.patients.findIndex(p => p.id === id);
        if (index === -1) return null;

        this.patients[index] = { ...this.patients[index], ...data };
        this.saveData();
        return this.patients[index];
    }
}

export const emrService = new EmrService();
