import { Prescription, PrescriptionData } from '../models/prescription';
import { emrService } from './emrService';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'prescriptions_db.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class PrescriptionService {
    private prescriptions: Prescription[] = [];

    constructor() {
        this.loadData();
        if (this.prescriptions.length === 0) {
            // this.initializeMockData(); // Disabled to allow clean manual entry
        }
    }

    private loadData() {
        if (fs.existsSync(DB_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                this.prescriptions = data.map((p: any) => ({
                    ...p,
                    createdAt: new Date(p.createdAt)
                }));
            } catch (error) {
                console.error("Failed to load Prescriptions DB", error);
            }
        }
    }

    private saveData() {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.prescriptions, null, 2));
    }

    private initializeMockData() {
        // Mock Prescription for Adam Alimi
        const mock: Prescription = {
            id: 'PRESC-MOCK-001',
            patientId: 'PAT-001',
            createdAt: new Date(),
            createdBy: 'Dr. System',
            data: {
                molecule: 'Amoxicilline',
                commercialName: 'Amoxil',
                qty: '1',
                unit: 'g',
                route: 'Orale',
                adminMode: 'instant',
                adminDuration: '',
                type: 'frequency',
                dilutionRequired: false,
                databaseMode: 'hospital',
                schedule: {
                    dailySchedule: 'everyday',
                    mode: 'simple',
                    interval: '',
                    isCustomInterval: false,
                    startDateTime: new Date().toISOString(),
                    durationValue: '5',
                    durationUnit: 'days',
                    selectedDays: [],
                    specificTimes: [],
                    simpleCount: '3',
                    simplePeriod: 'day',
                    intervalDuration: ''
                },
                substitutable: true
            }
        };
        this.prescriptions.push(mock);
        this.saveData();
    }

    // Get all prescriptions for a specific patient
    getPrescriptionsByPatient(patientId: string): Prescription[] {
        return this.prescriptions.filter(p => p.patientId === patientId);
    }

    // Create a new prescription
    createPrescription(patientId: string, data: PrescriptionData, createdBy: string = 'Current User'): Prescription {
        const newPrescription: Prescription = {
            id: `PRESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId,
            data,
            createdAt: new Date(),
            createdBy
        };

        this.prescriptions.push(newPrescription);
        this.saveData();
        return newPrescription;
    }

    // Delete a prescription by ID
    deletePrescription(id: string): boolean {
        const index = this.prescriptions.findIndex(p => p.id === id);
        if (index !== -1) {
            this.prescriptions.splice(index, 1);
            this.saveData();
            return true;
        }
        return false;
    }

    // Get a single prescription by ID
    getPrescriptionById(id: string): Prescription | undefined {
        return this.prescriptions.find(p => p.id === id);
    }

    // Get all patients who have prescriptions with their info, EXCLUDING biology prescriptions
    getPatientsWithPrescriptions() {
        // Filter out biology prescriptions for Pharmacy view
        const pharmacyPrescriptions = this.prescriptions.filter(p => p.data.prescriptionType !== 'biology');

        // Get unique patient IDs from relevant prescriptions
        const patientIdsWithPrescriptions = [...new Set(pharmacyPrescriptions.map(p => p.patientId))];

        // Fetch patient data and combine with prescription count
        const patientsWithPrescriptions = patientIdsWithPrescriptions
            .map(patientId => {
                const patient = emrService.getPatientById(patientId);
                if (!patient) return null;

                const prescriptionCount = pharmacyPrescriptions.filter(p => p.patientId === patientId).length;

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
}

export const prescriptionService = new PrescriptionService();
