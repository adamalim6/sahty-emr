
import { Patient, Admission, Appointment, Room, Gender, StockLocation, AdmissionMedicationConsumption } from '../models/emr';
import { TenantStore, GlobalStore } from '../utils/tenantStore';

// Data Interfaces
interface EmrTenantData {
    admissions: Admission[];
    appointments: Appointment[];
    consumptions: AdmissionMedicationConsumption[];
}

interface SettingsData {
    rooms: Room[];
    // other settings...
}

const DEFAULT_EMR_DATA: EmrTenantData = {
    admissions: [],
    appointments: [],
    consumptions: []
};

const DEFAULT_SETTINGS_DATA: SettingsData = {
    rooms: []
};

export class EmrService {
    
    private getStore(tenantId: string): TenantStore {
        return new TenantStore(tenantId);
    }

    private loadEmrData(tenantId: string): EmrTenantData {
        return this.getStore(tenantId).load<EmrTenantData>('emr_admissions', DEFAULT_EMR_DATA);
    }

    private saveEmrData(tenantId: string, data: EmrTenantData) {
        this.getStore(tenantId).save('emr_admissions', data);
    }

    // Bridge to Settings (Rooms)
    private loadRooms(tenantId: string): Room[] {
        const settings = this.getStore(tenantId).load<SettingsData>('settings', DEFAULT_SETTINGS_DATA);
        return settings.rooms || [];
    }

    private saveRooms(tenantId: string, rooms: Room[]) {
        const store = this.getStore(tenantId);
        const settings = store.load<SettingsData>('settings', DEFAULT_SETTINGS_DATA);
        settings.rooms = rooms;
        store.save('settings', settings);
    }

    // --- PATIENTS (GLOBAL) ---

    getAllPatients(): Patient[] {
        return GlobalStore.load<Patient[]>('patients', []);
    }

    getPatientById(id: string): Patient | undefined {
        const patients = this.getAllPatients();
        return patients.find(p => p.id === id);
    }

    createPatient(data: Partial<Patient>): Patient {
        const patients = this.getAllPatients();
        
        // Check for duplicates? (Optional enhancement)

        const newPatient: Patient = {
            id: `PAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            isProvisional: false,
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            gender: Gender.Male,
            ipp: `IPP-${Date.now()}`,
            ...data
        } as Patient;

        patients.push(newPatient);
        GlobalStore.save('patients', patients);
        return newPatient;
    }

    updatePatient(id: string, data: Partial<Patient>): Patient | null {
        const patients = this.getAllPatients();
        const index = patients.findIndex(p => p.id === id);
        if (index === -1) return null;

        patients[index] = { ...patients[index], ...data };
        GlobalStore.save('patients', patients);
        return patients[index];
    }

    // --- ADMISSIONS (TENANT) ---

    getAllAdmissions(tenantId: string): Admission[] {
        return this.loadEmrData(tenantId).admissions;
    }

    createAdmission(tenantId: string, data: Admission): Admission {
        const emrData = this.loadEmrData(tenantId);
        
        const newAdmission = { ...data, tenantId }; // Enforce tenantId
        emrData.admissions.push(newAdmission);

        // Occupy Room (Cross-module logic)
        if (newAdmission.roomNumber) {
            const rooms = this.loadRooms(tenantId);
            const room = rooms.find(r => r.number === newAdmission.roomNumber);
            if (room) {
                room.isOccupied = true;
                this.saveRooms(tenantId, rooms);
            }
        }

        this.saveEmrData(tenantId, emrData);
        return newAdmission;
    }

    closeAdmission(tenantId: string, id: string): Admission | null {
        const emrData = this.loadEmrData(tenantId);
        const admission = emrData.admissions.find(a => a.id === id);
        if (!admission) return null;

        admission.status = 'Sorti';
        admission.dischargeDate = new Date().toISOString();

        // Serialize changes
        this.saveEmrData(tenantId, emrData);

        // Free Room
        if (admission.roomNumber) {
            const rooms = this.loadRooms(tenantId);
            const room = rooms.find(r => r.number === admission.roomNumber);
            if (room) {
                room.isOccupied = false;
                this.saveRooms(tenantId, rooms);
            }
        }

        return admission;
    }

    // --- APPOINTMENTS (TENANT) ---

    getAllAppointments(tenantId: string): Appointment[] {
        return this.loadEmrData(tenantId).appointments;
    }

    // --- ROOMS (Bridge to Settings) ---

    getAllRooms(tenantId: string): Room[] {
        return this.loadRooms(tenantId);
    }

    // --- LOCATIONS (Legacy support, maybe mapped to Pharmacy Locations?) ---
    // EmrService had 'locations', likely redundant with Pharmacy.
    // We will return empty or fetch from Pharmacy module via TenantStore('pharmacy') if needed.
    // For now, removing to force usage of PharmacyService/SettingsService.
    // getLocations() removed.

    // --- CONSUMPTIONS (TENANT) ---

    addMedicationConsumption(tenantId: string, consumption: AdmissionMedicationConsumption) {
        const emrData = this.loadEmrData(tenantId);
        emrData.consumptions.push(consumption);
        this.saveEmrData(tenantId, emrData);
    }

    getConsumptionsByAdmission(tenantId: string, admissionId: string): AdmissionMedicationConsumption[] {
        const emrData = this.loadEmrData(tenantId);
        return emrData.consumptions.filter(c => c.admissionId === admissionId);
    }
}

export const emrService = new EmrService();
