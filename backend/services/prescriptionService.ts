
import { Prescription, PrescriptionData, PrescriptionExecution } from '../models/prescription';
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

    // Get all prescriptions for a specific patient
    getPrescriptionsByPatient(patientId: string): Prescription[] {
        return this.prescriptions.filter(p => p.patientId === patientId);
    }

    // Create a new prescription
    createPrescription(patientId: string, data: PrescriptionData, createdBy: string = 'Current User', clientId?: string): Prescription {
        const newPrescription: Prescription = {
            id: `PRESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId,
            data,
            createdAt: new Date(),
            createdBy,
            client_id: clientId
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
    // Filter by clientId if provided (for Multi-tenant Pharmacy View)
    getPatientsWithPrescriptions(clientId?: string) {
        // Filter out biology prescriptions for Pharmacy view
        const pharmacyPrescriptions = this.prescriptions.filter(p => {
             const isMed = p.data.prescriptionType !== 'biology';
             const matchClient = clientId ? (p.client_id === clientId) : true;
             return isMed && matchClient;
        });

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

    // --- EXECUTION MANAGEMENT ---

    // Load executions (Lazy load or specific DB file)
    private getExecutionsDBPath(): string {
        return path.join(DATA_DIR, 'executions_db.json');
    }

    private loadExecutions(): PrescriptionExecution[] {
        const dbPath = this.getExecutionsDBPath();
        if (fs.existsSync(dbPath)) {
            try {
                return JSON.parse(fs.readFileSync(dbPath, 'utf8')).map((e: any) => ({
                    ...e,
                    updatedAt: new Date(e.updatedAt)
                }));
            } catch (error) {
                console.error("Failed to load Executions DB", error);
                return [];
            }
        }
        return [];
    }

    private saveExecutions(executions: PrescriptionExecution[]) {
        const dbPath = this.getExecutionsDBPath();
        fs.writeFileSync(dbPath, JSON.stringify(executions, null, 2));
    }

    // Get Executions for a specific prescription
    getExecutions(prescriptionId: string): PrescriptionExecution[] {
        const allExecutions = this.loadExecutions();
        return allExecutions.filter(e => e.prescriptionId === prescriptionId);
    }

    // Record or Update an execution
    recordExecution(execution: Partial<PrescriptionExecution> & { prescriptionId: string, plannedDate: string }): PrescriptionExecution {
        const allExecutions = this.loadExecutions();
        // Check if execution already exists for this slot (prescription + plannedDate)
        // We use simple string match for plannedDate as it should be precise ISO from schedule calculation
        const existingIndex = allExecutions.findIndex(e =>
            e.prescriptionId === execution.prescriptionId &&
            e.plannedDate === execution.plannedDate
        );

        let savedExecution: PrescriptionExecution;

        if (existingIndex !== -1) {
            // Update
            savedExecution = {
                ...allExecutions[existingIndex],
                ...execution,
                updatedAt: new Date()
            };
            allExecutions[existingIndex] = savedExecution;
        } else {
            // Create
            savedExecution = {
                id: `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                prescriptionId: execution.prescriptionId,
                plannedDate: execution.plannedDate,
                status: execution.status || 'planned',
                justification: execution.justification,
                performedBy: execution.performedBy,
                actualDate: execution.actualDate,
                updatedAt: new Date()
            };
            allExecutions.push(savedExecution);
        }

        this.saveExecutions(allExecutions);
        return savedExecution;
    }
}

export const prescriptionService = new PrescriptionService();
