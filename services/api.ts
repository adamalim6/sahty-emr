
import { Patient, Admission, Appointment, Room } from '../types';
import { InventoryItem, ProductDefinition, StockLocation, PartnerInstitution, StockOutTransaction, SerializedPack } from '../types/pharmacy';
import { FormData } from '../components/Prescription/types';

const API_BASE_URL = 'http://localhost:3001/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expired or invalid - This SHOULD trigger logout usually
            localStorage.removeItem('token');
            // window.location.href = '/login'; // Optional: Force redirect
        }
        
        // 403 Forbidden - DO NOT LOGOUT the user. Just throw error.
        
        let errorMessage = response.statusText;
        try {
            const errorBody = await response.json();
            if (errorBody && errorBody.error) {
                errorMessage = errorBody.error;
            } else if (errorBody && errorBody.message) {
                 errorMessage = errorBody.message;
            }
        } catch (e) {
            // Failed to parse error body, stick with status text
        }

        throw new Error(errorMessage);
    }
    return response.json();
}

export const api = {
    // Actes Référentiel
    getActes: (params?: any) => {
        const query = new URLSearchParams(params).toString();
        return fetchJson<any>(`/actes?${query}`);
    },
    updateActe: (code: string, data: any) => fetchJson<any>(`/actes/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Authentication
    login: (credentials: any) => fetchJson<any>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    }),

    // EMR
    getPatients: () => fetchJson<Patient[]>('/emr/patients'),
    createPatient: (data: any) => fetchJson<Patient>('/emr/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getAdmissions: () => fetchJson<Admission[]>('/emr/admissions'),
    createAdmission: (data: Admission) => fetchJson<Admission>('/emr/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getAppointments: () => fetchJson<Appointment[]>('/emr/appointments'),
    getRooms: () => fetchJson<Room[]>('/emr/rooms'),

    // Pharmacy
    getInventory: (serviceId?: string) => {
        const query = serviceId ? `?serviceId=${serviceId}` : '';
        return fetchJson<InventoryItem[]>(`/pharmacy/inventory${query}`);
    },
    getLooseUnits: (serviceId?: string) => fetchJson<any[]>(`/pharmacy/loose-units${serviceId ? `?serviceId=${serviceId}` : ''}`),
    getCatalog: () => fetchJson<ProductDefinition[]>('/pharmacy/catalog'),
    getLocations: (serviceId?: string, scope?: 'PHARMACY' | 'SERVICE') => fetchJson<StockLocation[]>(`/pharmacy/locations?serviceId=${serviceId || ''}&scope=${scope || ''}`),
    createLocation: (data: any) => fetchJson<StockLocation>('/pharmacy/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateLocation: (data: any) => fetchJson<StockLocation>(`/pharmacy/locations/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteLocation: (id: string) => fetchJson<void>(`/pharmacy/locations/${id}`, {
        method: 'DELETE'
    }),
    getPartners: () => fetchJson<PartnerInstitution[]>('/pharmacy/partners'),
    createPartner: (data: any) => fetchJson<PartnerInstitution>('/pharmacy/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePartner: (data: any) => fetchJson<PartnerInstitution>(`/pharmacy/partners/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deletePartner: (id: string) => fetchJson<void>(`/pharmacy/partners/${id}`, {
        method: 'DELETE'
    }),
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

    // Super Admin
    getClients: () => fetchJson<any[]>('/super-admin/clients'),
    getClientDetails: (id: string) => fetchJson<any>(`/super-admin/clients/${id}`),
    createClient: (data: any) => fetchJson<any>('/super-admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateClient: (id: string, data: any) => fetchJson<any>(`/super-admin/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateClientDSI: (id: string, data: any) => fetchJson<any>(`/super-admin/clients/${id}/dsi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getOrganismes: () => fetchJson<any[]>('/super-admin/organismes'),
    createOrganisme: (data: any) => fetchJson<any>('/super-admin/organismes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getRoles: () => fetchJson<any[]>('/super-admin/roles'),
    getRole: (id: string) => fetchJson<any>(`/super-admin/roles/${id}`),
    createRole: (data: any) => fetchJson<any>('/super-admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateRole: (id: string, data: any) => fetchJson<any>(`/super-admin/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Tenant Settings
    getTenantUsers: () => fetchJson<any[]>('/settings/users'),
    createTenantUser: (data: any) => fetchJson<any>('/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateTenantUser: (id: string, data: any) => fetchJson<any>(`/settings/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getGlobalRoles: () => fetchJson<any[]>('/settings/roles'),

    // Services
    getServices: () => fetchJson<any[]>('/settings/services'),
    getService: (id: string) => fetchJson<any>(`/settings/services/${id}`),
    createService: (data: any) => fetchJson<any>('/settings/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateService: (id: string, data: any) => fetchJson<any>(`/settings/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteService: (id: string) => fetchJson<any>(`/settings/services/${id}`, {
        method: 'DELETE'
    }),
    
    // Service Layout
    getServiceUnits: (serviceId: string) => fetchJson<any[]>(`/settings/services/${serviceId}/units`),
    createServiceUnit: (serviceId: string, data: any) => fetchJson<any>(`/settings/services/${serviceId}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteServiceUnit: (unitId: string) => fetchJson<any>(`/settings/services/units/${unitId}`, {
        method: 'DELETE'
    }),

    getTenantRooms: (params?: any) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchJson<any[]>(`/settings/rooms${query}`);
    },
    createRoom: (data: any) => fetchJson<any>('/settings/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateRoom: (id: string, data: any) => fetchJson<any>(`/settings/rooms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteRoom: (id: string) => fetchJson<any>(`/settings/rooms/${id}`, {
        method: 'DELETE'
    }),
    getPricing: () => fetchJson<any[]>('/settings/pricing'),
    createPricing: (data: any) => fetchJson<any>('/settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Pharmacy Extended
    getSerializedPacks: () => fetchJson<SerializedPack[]>('/pharmacy/packs'),
    getSerializedPacksByProduct: (productId: string) => fetchJson<SerializedPack[]>(`/pharmacy/packs?productId=${productId}`),
    getEmrLocations: () => fetchJson<StockLocation[]>('/pharmacy/locations?scope=SERVICE'), // EMR needs Service locations
    createEmrLocation: (data: any) => fetchJson<StockLocation>('/pharmacy/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateEmrLocation: (data: any) => fetchJson<StockLocation>(`/pharmacy/locations/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteEmrLocation: (id: string) => fetchJson<void>(`/pharmacy/locations/${id}`, {
        method: 'DELETE'
    }),

    // Replenishment
    getReplenishmentRequests: () => fetchJson<any[]>('/pharmacy/replenishments'),
    createReplenishmentRequest: (data: any) => fetchJson<any>('/pharmacy/replenishments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateReplenishmentRequestStatus: (id: string, status: string, processedRequest?: any) => fetchJson<any>(`/pharmacy/replenishments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, processedRequest })
    }),
    dispenseReplenishmentItem: (requestId: string, data: any) => fetchJson<any>(`/pharmacy/replenishments/${requestId}/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Dispensation
    dispenseWithFEFO: (data: any) => fetchJson<any>('/pharmacy/dispensations/fefo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getDispensationsByAdmission: (admissionId: string) => fetchJson<any[]>(`/pharmacy/dispensations/admission/${admissionId}`),
    getDispensationsByPrescription: (prescriptionId: string) => fetchJson<any[]>(`/pharmacy/dispensations/prescription/${prescriptionId}`),
    getConsumptionsByAdmission: (admissionId: string) => fetchJson<any[]>(`/emr/admissions/${admissionId}/consumptions`),
    getReturnsByAdmission: (admissionId: string) => fetchJson<any[]>(`/pharmacy/returns/admission/${admissionId}`),
    createReturnRequest: (data: any) => fetchJson<any>('/pharmacy/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Missing Pharmacy Methods
    getPurchaseOrders: () => fetchJson<any[]>('/pharmacy/orders'),
    createPurchaseOrder: (data: any) => fetchJson<any>('/pharmacy/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getDeliveryNotes: () => fetchJson<any[]>('/pharmacy/deliveries'),
    createDeliveryNote: (data: any) => fetchJson<any>('/pharmacy/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    getSuppliers: () => fetchJson<any[]>('/pharmacy/suppliers'),
    createSupplier: (data: any) => fetchJson<any>('/pharmacy/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateSupplier: (data: any) => fetchJson<any>(`/pharmacy/suppliers/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteSupplier: (id: string) => fetchJson<any>(`/pharmacy/suppliers/${id}`, {
        method: 'DELETE'
    }),
    createProduct: (data: any) => fetchJson<any>('/pharmacy/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateProduct: (data: any) => fetchJson<any>(`/pharmacy/catalog/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    processQuarantine: (data: any) => fetchJson<any>('/pharmacy/quarantine/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Global Suppliers
    getGlobalSuppliers: () => fetchJson<any[]>('/super-admin/suppliers'),
    
    createGlobalSupplier: (data: any) => fetchJson<any>('/super-admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    updateGlobalSupplier: (id: string, data: any) => fetchJson<any>(`/super-admin/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    deleteGlobalSupplier: (id: string) => fetchJson<any>(`/super-admin/suppliers/${id}`, {
        method: 'DELETE'
    })
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
