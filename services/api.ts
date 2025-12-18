
import { Patient, Admission, Appointment, Room } from '../types';
import { InventoryItem, ProductDefinition, StockLocation, PartnerInstitution, StockOutTransaction } from '../types/pharmacy';
import { FormData } from '../components/Prescription/types';

const API_BASE_URL = 'http://localhost:3001/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
}

export const api = {
    // EMR
    getPatients: () => fetchJson<Patient[]>('/emr/patients'),
    getAdmissions: () => fetchJson<Admission[]>('/emr/admissions'),
    getAppointments: () => fetchJson<Appointment[]>('/emr/appointments'),
    getRooms: () => fetchJson<Room[]>('/emr/rooms'),

    // Pharmacy
    getInventory: () => fetchJson<InventoryItem[]>('/pharmacy/inventory'),
    getCatalog: () => fetchJson<ProductDefinition[]>('/pharmacy/catalog'),
    getLocations: () => fetchJson<StockLocation[]>('/pharmacy/locations'),
    getPartners: () => fetchJson<PartnerInstitution[]>('/pharmacy/partners'),
    getStockOutHistory: () => fetchJson<StockOutTransaction[]>('/pharmacy/stock-out-history'),

    // Prescriptions
    getPrescriptions: (patientId: string) => fetchJson<any[]>(`/prescriptions/${patientId}`),
    createPrescription: (patientId: string, data: FormData) =>
        fetchJson<any>(`/prescriptions/${patientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
    deletePrescription: (id: string) =>
        fetchJson<any>(`/prescriptions/${id}`, {
            method: 'DELETE'
        }),

    // Get all patients who have prescriptions
    getPatientsWithPrescriptions: () =>
        fetchJson<PatientWithPrescriptions[]>('/prescriptions/patients/with-prescriptions'),
};

// Type for patient with prescription data
export interface PatientWithPrescriptions {
    id: string;
    ipp: string;
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    cin?: string;
    prescriptionCount: number;
}
