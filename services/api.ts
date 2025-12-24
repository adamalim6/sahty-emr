import { Patient, Admission, Appointment, Room } from '../types';
import {
    InventoryItem, ProductDefinition, StockLocation, PartnerInstitution,
    StockOutTransaction, PurchaseOrder, DeliveryNote, PharmacySupplier,
    SerializedPack, DispensedItem, PatientWithPrescriptions, ReplenishmentRequest, ReplenishmentStatus
} from '../types/pharmacy';
import { Dispensation } from '../types/serialized-pack';
export type { PatientWithPrescriptions }; // Re-export it
import { FormData } from '../components/Prescription/types';

const API_BASE_URL = 'http://localhost:3001/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || response.statusText);
    }
    return response.json();
}

export const api = {
    // Patients
    getPatients: () => fetchJson<Patient[]>('/emr/patients'),
    getPatient: (id: string) => fetchJson<Patient>(`/emr/patients/${id}`),
    createPatient: (patient: Omit<Patient, 'id'>) => fetchJson<Patient>('/emr/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patient)
    }),
    updatePatient: (id: string, patient: Partial<Patient>) => fetchJson<Patient>(`/emr/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patient)
    }),

    // EMR Core
    getAdmissions: () => fetchJson<Admission[]>('/emr/admissions'),
    createAdmission: (admission: Omit<Admission, 'id'>) => fetchJson<Admission>('/emr/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(admission)
    }),
    updateAdmission: (id: string, updates: Partial<Admission>) => fetchJson<Admission>(`/emr/admissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    }),
    getAppointments: () => fetchJson<Appointment[]>('/emr/appointments'),
    getRooms: () => fetchJson<Room[]>('/emr/rooms'),

    // EMR Locations
    getEmrLocations: () => fetchJson<StockLocation[]>('/emr/locations'),
    createEmrLocation: (location: any) => fetchJson<StockLocation>('/emr/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
    }),
    updateEmrLocation: (location: StockLocation) => fetchJson<StockLocation>(`/emr/locations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
    }),
    deleteEmrLocation: (id: string) => fetch(`${API_BASE_URL} /emr/locations / ${id} `, { method: 'DELETE' }).then(res => {
        if (!res.ok) throw new Error('Delete failed');
    }),

    // Pharmacy Module
    getInventory: () => fetchJson<InventoryItem[]>('/pharmacy/inventory'),
    getCatalog: () => fetchJson<ProductDefinition[]>('/pharmacy/catalog'),
    getLocations: () => fetchJson<StockLocation[]>('/pharmacy/locations'),

    createLocation: (location: any) => fetchJson<StockLocation>('/pharmacy/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
    }),
    updateLocation: (location: StockLocation) => fetchJson<StockLocation>(`/pharmacy/locations/${location.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
    }),
    deleteLocation: (id: string) => fetch(`${API_BASE_URL} /pharmacy/locations / ${id} `, { method: 'DELETE' }).then(res => {
        if (!res.ok) throw new Error('Delete failed');
    }),

    // Suppliers
    getSuppliers: () => fetchJson<PharmacySupplier[]>('/pharmacy/suppliers'),
    createSupplier: (supplier: Partial<PharmacySupplier>) => fetchJson<PharmacySupplier>('/pharmacy/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
    }),
    updateSupplier: (supplier: PharmacySupplier) => fetchJson<PharmacySupplier>(`/pharmacy/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplier)
    }),
    deleteSupplier: (id: string) => fetch(`${API_BASE_URL} /pharmacy/suppliers / ${id} `, { method: 'DELETE' }).then(res => {
        if (!res.ok) throw new Error('Delete failed');
    }),

    getPartners: () => fetchJson<PartnerInstitution[]>('/pharmacy/partners'),
    getStockOutHistory: () => fetchJson<StockOutTransaction[]>('/pharmacy/stock-out-history'),

    createProduct: (product: ProductDefinition) => fetchJson<ProductDefinition>('/pharmacy/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    }),
    updateProduct: (product: ProductDefinition) => fetchJson<ProductDefinition>(`/pharmacy/catalog/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    }),

    // Supply Chain
    getPurchaseOrders: () => fetchJson<PurchaseOrder[]>('/pharmacy/orders'),
    createPurchaseOrder: (po: PurchaseOrder) => fetchJson<PurchaseOrder>('/pharmacy/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(po)
    }),

    getDeliveryNotes: () => fetchJson<DeliveryNote[]>('/pharmacy/deliveries'),
    createDeliveryNote: (note: DeliveryNote) => fetchJson<DeliveryNote>('/pharmacy/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
    }),

    processQuarantine: (result: any) => fetchJson<any>('/pharmacy/quarantine/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
    }),

    // Prescriptions
    getPrescriptions: (patientId?: string) => fetchJson<any[]>(patientId ? `/prescriptions/${patientId}` : '/prescriptions'),
    createPrescription: (patientId: string, prescription: FormData) => fetchJson(`/prescriptions/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prescription)
    }),
    deletePrescription: (id: string) => fetchJson(`/prescriptions/${id}`, {
        method: 'DELETE'
    }),

    // Prescription Executions
    recordExecution: (prescriptionId: string, execution: any) => fetchJson<any>(`/prescriptions/${prescriptionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(execution)
    }),
    getExecutions: (prescriptionId: string) => fetchJson<any[]>(`/prescriptions/${prescriptionId}/executions`),

    // Serialization
    getSerializedPacks: () => fetchJson<SerializedPack[]>('/pharmacy/packs'),

    getSerializedPacksByProduct: (productId: string) => fetchJson<SerializedPack[]>(`/pharmacy/packs?productId=${productId}`),

    // NOTE: This call might 404 if pack not found?
    getSerializedPackById: (id: string) => fetchJson<SerializedPack>(`/pharmacy/packs/${id}`),

    // Dispensation (Serialization aware)
    dispenseWithFEFO: (params: {
        productId: string,
        quantity: number,
        mode: 'UNIT' | 'FULL_PACK',
        userId: string,
        prescriptionId: string,
        admissionId?: string, // Added admissionId
        targetPackIds?: string[]
    }) => fetchJson<DispensedItem[]>('/pharmacy/dispensations/fefo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    }),

    getDispensationsByPrescription: (prescriptionId: string) => fetchJson<Dispensation[]>(`/pharmacy/dispensations/prescription/${prescriptionId}`),
    getDispensationsByAdmission: (admissionId: string) => fetchJson<Dispensation[]>(`/pharmacy/dispensations/admission/${admissionId}`),

    // New endpoint for PrescriptionManager
    getPatientsWithPrescriptions: () => fetchJson<PatientWithPrescriptions[]>('/prescriptions/patients/with-prescriptions'),

    // Replenishment
    getReplenishmentRequests: () => fetchJson<ReplenishmentRequest[]>('/pharmacy/replenishments'),
    createReplenishmentRequest: (request: Partial<ReplenishmentRequest>) => fetchJson<ReplenishmentRequest>('/pharmacy/replenishments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    }),
    updateReplenishmentRequestStatus: (id: string, status: ReplenishmentStatus, processedRequest?: ReplenishmentRequest) => fetchJson<ReplenishmentRequest>(`/pharmacy/replenishments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, processedRequest })
    }),
};
