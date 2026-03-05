import { Patient, Admission, Appointment, Room } from '../types';
import { InventoryItem, ProductDefinition, StockLocation, PartnerInstitution, StockOutTransaction, SerializedPack } from '../types/pharmacy';
import { FormData } from '../components/Prescription/types';

export interface CareCategory {
    id: string;
    code: string;
    label: string;
    isActive: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

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
        let errorBody: any = {};
        try {
            errorBody = await response.json();
            if (errorBody && errorBody.error) {
                errorMessage = errorBody.error;
            } else if (errorBody && errorBody.message) {
                 errorMessage = errorBody.message;
            }
        } catch (e) {
            // Failed to parse error body, stick with status text
        }

        const error = new Error(errorMessage);
        Object.assign(error, errorBody); // Attach all properties (claimedBy, claimedAt, etc.)
        throw error;
    }
    return response.json();
}

export const api = {
    async getATCTree() {
        return fetchJson<any>('/global/atc/tree');
    },

    async getEMDNTree() {
        return fetchJson<any>('/global/emdn/tree');
    },

    // Actes Référentiel
    getActes: (params?: any) => {
        const query = new URLSearchParams(params).toString();
        return fetchJson<any>(`/super-admin/reference/actes?${query}`);
    },
    getTenantActes: (params?: { search?: string, family?: string, page?: number, limit?: number }) => {
        const query = new URLSearchParams(params as any).toString();
        return fetchJson<any>(`/actes?${query}`);
    },
    updateActe: (code: string, data: any) => fetchJson<any>(`/super-admin/reference/actes/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Familles d'Actes
    getFamilles: () => fetchJson<any[]>('/super-admin/reference/familles'),
    createFamille: (data: any) => fetchJson<any>('/super-admin/reference/familles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateFamille: (id: string, data: any) => fetchJson<any>(`/super-admin/reference/familles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteFamille: (id: string) => fetchJson<any>(`/super-admin/reference/familles/${id}`, {
        method: 'DELETE'
    }),

    // Sous-Familles d'Actes
    getSousFamilles: () => fetchJson<any[]>('/super-admin/reference/sous-familles'),
    createSousFamille: (data: any) => fetchJson<any>('/super-admin/reference/sous-familles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateSousFamille: (id: string, data: any) => fetchJson<any>(`/super-admin/reference/sous-familles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteSousFamille: (id: string) => fetchJson<any>(`/super-admin/reference/sous-familles/${id}`, {
        method: 'DELETE'
    }),

    // Authentication
    login: (credentials: any) => fetchJson<any>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    }),

    loginSuperAdmin: (credentials: any) => fetchJson<any>('/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    }),

    // EMR
    getPatients: () => fetchJson<Patient[]>('/emr/patients'),
    getPatient: (id: string) => fetchJson<Patient>(`/emr/patients/${id}`),
    createPatient: (data: any) => fetchJson<{ tenantPatientId: string }>('/emr/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updatePatient: (id: string, data: any) => fetchJson<{ tenantPatientId: string }>(`/emr/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    addEmergencyContact: (patientId: string, data: any) => fetchJson<any>(`/emr/patients/${patientId}/emergency-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    // Hospital Config
    getHospitalServices: () => fetchJson<any[]>('/emr/hospital/services'),
    getHospitalDoctors: () => fetchJson<any[]>('/emr/hospital/doctors'),
    getServiceBeds: (serviceId: string) => fetchJson<any[]>(`/emr/services/${serviceId}/occupancy`),

    // ===========================================
    // TRANSFUSION
    // ===========================================
    getTransfusionBags: (patientId: string) => fetchJson<any[]>(`/emr/patients/${patientId}/transfusions/bags`),
    createTransfusionBag: (patientId: string, data: any) => fetchJson<any>(`/emr/patients/${patientId}/transfusions/bags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    discardTransfusionBag: (bagId: string) => fetchJson<any>(`/emr/transfusions/bags/${bagId}/discard`, {
        method: 'POST'
    }),
    getTransfusionTimeline: (patientId: string) => fetchJson<any>(`/emr/patients/${patientId}/transfusions/timeline`),

    // ===========================================
    // ADMISSIONS
    // ===========================================
    getAdmissions: () => fetchJson<Admission[]>('/emr/admissions'),
    createAdmission: (data: Admission) => fetchJson<Admission>('/emr/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    // Patient Registration Refactor
    searchUniversal: (query: string) => fetchJson<any[]>(`/emr/patients/universal-search?query=${encodeURIComponent(query)}`),
    importGlobalPatient: (globalId: string) => fetchJson<{ tenantPatientId: string }>('/emr/patients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalId })
    }),
    getTenantOrganismes: () => fetchJson<any[]>('/emr/reference/organismes'),
    getTenantCountries: () => fetchJson<any[]>('/emr/reference/countries'),
    getTenantIdentityDocumentTypes: () => fetchJson<any[]>('/emr/reference/identity-document-types'),
    
    // Reference Data (Prescriptions)
    getReferenceDCIs: (query: string) => fetchJson<{ data: any[] }>(`/global/dci?q=${encodeURIComponent(query)}&limit=50`),
    getReferenceProducts: (query: string, dciId?: string) => {
        let url = `/global/products?page=1&limit=50&q=${encodeURIComponent(query)}`;
        if (dciId) {
            url += `&dciId=${dciId}`;
        }
        return fetchJson<{ data: any[] }>(url);
    },

    // Coverage Search
    searchCoverages: (organismeId: string, policyNumber: string) => 
        fetchJson<any[]>(`/emr/coverages/search?organismeId=${organismeId}&policyNumber=${encodeURIComponent(policyNumber)}`),

    // Pharmacy Attributes
    
    // Service Stock (EMR-based - for nurses/clinical staff)
    getServiceStock: (serviceId?: string) => {
        const params = serviceId ? `?serviceId=${serviceId}` : '';
        return fetchJson<any[]>(`/emr/service-stock${params}`);
    },
    getUserServices: () => fetchJson<{ id: string; name: string }[]>('/emr/user-services'),

    // Pharmacy
    getInventory: (serviceId?: string, scope?: 'PHARMACY' | 'SERVICE') => {
        const params = new URLSearchParams();
        if (serviceId) params.append('serviceId', serviceId);
        if (scope) params.append('scope', scope);
        const query = params.toString() ? `?${params.toString()}` : '';
        return fetchJson<InventoryItem[]>(`/pharmacy/inventory${query}`);
    },
    getLooseUnits: (serviceId?: string) => fetchJson<any[]>(`/pharmacy/loose-units${serviceId ? `?serviceId=${serviceId}` : ''}`),
    getCatalog: (params?: { page?: number; limit?: number; q?: string; status?: 'ALL' | 'ACTIVE' | 'INACTIVE' }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
        return fetchJson<any>(`/pharmacy/catalog${query}`);
    },
    getLocations: (serviceId?: string, scope?: 'PHARMACY' | 'SERVICE') => fetchJson<StockLocation[]>(`/pharmacy/locations?serviceId=${serviceId || ''}&scope=${scope || 'PHARMACY'}`),
    
    /**
     * Context-Based Location Access
     * - CONFIG_LOCATIONS: Pharmacy Emplacements config (PHARMACY + PHYSICAL)
     * - STOCK_PHARMACY: Stock Pharma page (PHARMACY + PHYSICAL)
     * - STOCK_SERVICE: Stock Service page (SERVICE + PHYSICAL + serviceId)
     * - SYSTEM_LOCATIONS: All locations including VIRTUAL
     */
    getLocationsByContext: (context: 'CONFIG_LOCATIONS' | 'STOCK_PHARMACY' | 'STOCK_SERVICE' | 'SYSTEM_LOCATIONS', serviceId?: string) => 
        fetchJson<StockLocation[]>(`/pharmacy/locations/by-context?context=${context}${serviceId ? `&serviceId=${serviceId}` : ''}`),
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
    getReturnQuarantineLocation: async () => {
        const locations = await fetchJson<StockLocation[]>(`/pharmacy/locations?scope=PHARMACY`);
        return locations.find(l => l.name === 'RETURN_QUARANTINE');
    },
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
    pausePrescription: (id: string) =>
        fetchJson<any>(`/prescriptions/${id}/pause`, {
            method: 'POST'
        }),
    resumePrescription: (id: string) =>
        fetchJson<any>(`/prescriptions/${id}/resume`, {
            method: 'POST'
        }),
    stopPrescription: (id: string, reason?: string) =>
        fetchJson<any>(`/prescriptions/${id}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        }),

    // Get all patients who have prescriptions
    getPatientsWithPrescriptions: () =>
        fetchJson<PatientWithPrescriptions[]>('/prescriptions/patients/with-prescriptions'),

    // Super Admin — Tenants
    getTenants: () => fetchJson<any[]>('/super-admin/tenants'),
    getTenantDetails: (id: string) => fetchJson<any>(`/super-admin/tenants/${id}`),
    createTenant: (data: any) => fetchJson<any>('/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateTenant: (id: string, data: any) => fetchJson<any>(`/super-admin/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateTenantDSI: (id: string, data: any) => fetchJson<any>(`/super-admin/tenants/${id}/dsi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    updateTenantReferenceSchema: (id: string) => fetchJson<any>(`/super-admin/tenants/${id}/update-reference-schema`, {
        method: 'POST'
    }),
    
    updateAllReferenceSchemas: () => fetchJson<any>(`/super-admin/tenants/update-all-reference-schemas`, {
        method: 'POST'
    }),
    // Backwards-compat aliases
    getClients: () => fetchJson<any[]>('/super-admin/tenants'),
    getClientDetails: (id: string) => fetchJson<any>(`/super-admin/tenants/${id}`),
    createClient: (data: any) => fetchJson<any>('/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateClient: (id: string, data: any) => fetchJson<any>(`/super-admin/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateClientDSI: (id: string, data: any) => fetchJson<any>(`/super-admin/tenants/${id}/dsi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Care Categories
    getCareCategories: () => fetchJson<CareCategory[]>('/super-admin/care-categories'),
    createCareCategory: (data: Partial<CareCategory>) => fetchJson<CareCategory>('/super-admin/care-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateCareCategory: (id: string, data: Partial<CareCategory>) => fetchJson<CareCategory>(`/super-admin/care-categories/${id}`, {
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
    getSettingsRole: (id: string) => fetchJson<any>(`/settings/roles/${id}`), // NEW
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
    deactivateServiceUnit: (unitId: string) => fetchJson<any>(`/settings/services/units/${unitId}/deactivate`, {
        method: 'PUT'
    }),
    reactivateServiceUnit: (unitId: string) => fetchJson<any>(`/settings/services/units/${unitId}/reactivate`, {
        method: 'PUT'
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


    // NOTE: Legacy replenishment API methods removed - use stock transfer APIs instead
    // getReplenishmentRequests -> getStockDemands
    // createReplenishmentRequest -> createStockDemand
    // updateReplenishmentRequestStatus -> updateStockDemandStatus

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
    updateProduct: (data: any, reason?: string) => fetchJson<any>(`/pharmacy/catalog/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, reason: reason || data.reason })
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
    }),

    // Groups
    getGroups: () => fetchJson<any[]>('/super-admin/groups'),
    getGroup: (id: string) => fetchJson<any>(`/super-admin/groups/${id}`),
    createGroup: (data: any) => fetchJson<any>('/super-admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGroup: (id: string, data: any) => fetchJson<any>(`/super-admin/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteGroup: (id: string) => fetchJson<any>(`/super-admin/groups/${id}`, {
        method: 'DELETE'
    }),

    // Global Routes (Voies d'administration)
    getGlobalRoutes: () => fetchJson<any[]>('/super-admin/observation/routes'),
    createGlobalRoute: (data: any) => fetchJson<any>('/super-admin/observation/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalRoute: (id: string, data: any) => fetchJson<any>(`/super-admin/observation/routes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // Global Products
    getGlobalProducts: (params?: { page?: number; limit?: number; q?: string }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
        return fetchJson<any>(`/global/products${query}`);
    },
    getGlobalProduct: (id: string) => fetchJson<ProductDefinition>(`/global/products/${id}`),
    createGlobalProduct: (data: any) => fetchJson<ProductDefinition>('/global/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalProduct: (id: string, data: any) => fetchJson<ProductDefinition>(`/global/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteGlobalProduct: (id: string) => fetchJson<void>(`/global/products/${id}`, {
        method: 'DELETE'
    }),
    getProductPriceHistory: (id: string) => fetchJson<any[]>(`/global/products/${id}/price-history`),

    // Global DCI
    getGlobalDCIs: (params?: { page?: number; limit?: number; q?: string }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
        return fetchJson<any>(`/global/dci${query}`);
    },
    createGlobalDCI: (data: any) => fetchJson<any>('/global/dci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalDCI: (id: string, data: any) => fetchJson<any>(`/global/dci/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    deleteGlobalDCI: (id: string) => fetchJson<void>(`/global/dci/${id}`, {
        method: 'DELETE'
    }),

    // --- Unified Stock Transfer Engine ---
    
    createStockDemand: (data: any) => fetchJson<any>('/stock-transfers/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    getStockDemands: (serviceId?: string) => {
        const query = serviceId ? `?serviceId=${serviceId}` : '';
        return fetchJson<any[]>(`/stock-transfers/demands${query}`);
    },
    
    getStockDemandDetails: (demandId: string) => fetchJson<any>(`/stock-transfers/demands/${demandId}`),
    
    updateStockDemandStatus: (demandId: string, status: string) => fetchJson<any>(`/stock-transfers/demands/${demandId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    }),
    
    createStockTransferDraft: (data: any) => fetchJson<any>('/stock-transfers/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    getStockTransferDetails: (transferId: string) => fetchJson<any>(`/stock-transfers/transfers/${transferId}`),
    
    executeStockTransfer: (transferId: string) => fetchJson<any>(`/stock-transfers/transfers/${transferId}/execute`, {
        method: 'POST'
    }),
    
    getStockDemandCatalog: (params?: { page?: number; limit?: number; q?: string; status?: 'ALL' | 'ACTIVE' | 'INACTIVE' }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
        return fetchJson<any>(`/stock-transfers/catalog${query}`);
    },

    getTransferHistory: (productId: string) => fetchJson<any[]>(`/stock-transfers/history/${productId}`),

    // Service locations for demand creation (accessible to EMR users)
    getServiceLocations: (serviceId: string) => fetchJson<StockLocation[]>(`/stock-transfers/service-locations?serviceId=${serviceId}`),

    // --- Stock Reservations (HOLD Engine) ---
    
    holdStockReservation: (data: any) => fetchJson<any>('/stock-reservations/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    releaseStockReservation: (reservationId: string) => fetchJson<any>(`/stock-reservations/line/${reservationId}`, {
        method: 'DELETE'
    }),
    
    releaseStockReservationSession: (sessionId: string) => fetchJson<any>('/stock-reservations/release-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
    }),
    
    getStockReservationCart: (sessionId: string) => fetchJson<any>(`/stock-reservations/cart/${sessionId}`),

    getActiveReservationForDemand: (demandId: string) => fetchJson<any | null>(`/stock-reservations/active-for-demand/${demandId}`),
    
    commitStockReservationSession: (sessionId: string, relatedDemandId: string) => fetchJson<any>('/stock-reservations/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, related_demand_id: relatedDemandId })
    }),

    // --- Concurrency Control ---
    claimDemand: (demandId: string) => fetchJson<any>(`/stock-transfers/demands/${demandId}/claim`, { method: 'POST' }),

    releaseDemand: (demandId: string) => fetchJson<any>(`/stock-transfers/demands/${demandId}/release`, { method: 'POST' }),
    // --- Stock Returns (Service -> Pharmacy) ---
    // --- Stock Returns (Service -> Pharmacy) ---
    getReturns: (serviceId?: string) => {
        const query = serviceId ? `?serviceId=${serviceId}` : '';
        return fetchJson<any[]>(`/emr/returns${query}`);
    },
    getReturnDetails: (id: string) => fetchJson<any>(`/emr/returns/${id}`),
    createReturn: (data: { serviceId: string, reservationId: string }) => fetchJson<any>('/emr/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // --- Stock Receptions (Pharmacy) ---
    getPharmacyReturns: (status?: string, serviceId?: string) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (serviceId) params.append('serviceId', serviceId);
        return fetchJson<any[]>(`/pharmacy/returns?${params.toString()}`);
    },
    getPharmacyReturnDetails: (id: string) => fetchJson<any>(`/pharmacy/returns/${id}`),
    
    // [NEW] Get Receptions History for a Return
    getReturnReceptions: (returnId: string) => fetchJson<any[]>(`/pharmacy/returns/${returnId}/receptions`),

    getReceptionDetails: (receptionId: string) => fetchJson<any>(`/pharmacy/receptions/${receptionId}`),

    createReception: (data: { returnId: string, lines: { returnLineId: string, qtyReceived: number }[] }) => fetchJson<any>('/pharmacy/receptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // [NEW] Return Decisions
    createReturnDecision: (receptionId: string, decisions: { returnLineId: string; qty: number; outcome: 'COMMERCIAL' | 'CHARITY' | 'WASTE'; destinationLocationId?: string }[]) => fetchJson<any>(`/pharmacy/receptions/${receptionId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions })
    }),

    getReceptionsDecisions: (receptionId: string) => fetchJson<any[]>(`/pharmacy/receptions/${receptionId}/decisions`),

    // ==========================================
    // OBSERVATION CATALOG (EMR READ-ONLY)
    // ==========================================
    getObservationParameters: () => fetchJson<any[]>('/settings/observation/parameters'),
    getObservationGroups: () => fetchJson<any[]>('/settings/observation/groups'),
    getObservationFlowsheets: () => fetchJson<any[]>('/settings/observation/flowsheets'),
    getUnits: () => fetchJson<any[]>('/settings/observation/units'),
    getRoutes: () => fetchJson<any[]>('/settings/observation/routes'),

    // ==========================================
    // OBSERVATION CATALOG (GLOBAL / SUPERADMIN)
    // ==========================================
    getGlobalObservationParameters: () => fetchJson<any[]>('/super-admin/observation/parameters'),
    createGlobalObservationParameter: (data: any) => fetchJson<any>('/super-admin/observation/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalObservationParameter: (id: string, data: any) => fetchJson<any>(`/super-admin/observation/parameters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    getGlobalObservationGroups: () => fetchJson<any[]>('/super-admin/observation/groups'),
    createGlobalObservationGroup: (data: any) => fetchJson<any>('/super-admin/observation/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    getGlobalObservationFlowsheets: () => fetchJson<any[]>('/super-admin/observation/flowsheets'),
    createGlobalObservationFlowsheet: (data: { flowsheet: any, groupIds: string[] }) => fetchJson<any>('/super-admin/observation/flowsheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalObservationFlowsheet: (id: string, data: { flowsheet: any, groupIds: string[] }) => fetchJson<any>(`/super-admin/observation/flowsheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    getGlobalUnits: () => fetchJson<any[]>('/super-admin/observation/units'),
    createGlobalUnit: (data: any) => fetchJson<any>('/super-admin/observation/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    updateGlobalUnit: (id: string, data: any) => fetchJson<any>(`/super-admin/observation/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    // ==========================================
    // *** DIAGNOSES (MEDICAL DOSSIER) ***
    getPatientDiagnoses: (tenantPatientId: string) => fetchJson<any[]>(`/emr/patients/${tenantPatientId}/diagnoses`),
    createDiagnosis: (tenantPatientId: string, payload: any) => fetchJson<any>(`/emr/patients/${tenantPatientId}/diagnoses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }),
    resolveDiagnosis: (diagnosisId: string, resolution_note?: string) => fetchJson<any>(`/emr/diagnoses/${diagnosisId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_note })
    }),
    voidDiagnosis: (diagnosisId: string, void_reason: string) => fetchJson<any>(`/emr/diagnoses/${diagnosisId}/void`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason })
    }),
    reactivateDiagnosis: (diagnosisId: string) => fetchJson<any>(`/emr/diagnoses/${diagnosisId}/reactivate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
    }),

    // ==========================================
    // EMR SURVEILLANCE / MAR
    // ==========================================
    getSurveillanceTimeline: (patientId: string, params: { admissionId?: string, flowsheetId?: string, fromDate: string, toDate: string }) => {
        let qs = `?from=${encodeURIComponent(params.fromDate)}&to=${encodeURIComponent(params.toDate)}`;
        if (params.admissionId) qs += `&admission_id=${encodeURIComponent(params.admissionId)}`;
        if (params.flowsheetId) qs += `&flowsheet_id=${encodeURIComponent(params.flowsheetId)}`;
        return fetchJson<any>(`/emr/patients/${patientId}/surveillance/timeline${qs}`);
    },

    updateSurveillanceCell: (patientId: string, data: { admissionId?: string, bucketStart: string, parameterCode: string, value: any, expectedRevision: number }) => fetchJson<any>(`/patients/${patientId}/surveillance/cell`, {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    getExecutions: (prescriptionId: string) => fetchJson<any[]>(`/prescriptions/${prescriptionId}/executions`),

    recordExecution: (prescriptionId: string, payload: any) => {
        // Find which event ID to use for the URL path.
        const targetEventId = payload.assigned_prescription_event_id || payload.predictionEventId || payload.eventId;
        
        return fetchJson<any>(`/prescriptions/${prescriptionId}/events/${targetEventId}/admin`, {
            method: 'POST',
            body: JSON.stringify({
                actionType: payload.action_type,
                occurredAt: payload.occurred_at,
                actualStartAt: payload.actual_start_at,
                actualEndAt: payload.actual_end_at,
                note: payload.justification,
                transfusion: payload.transfusion,
                administered_bags: payload.administered_bags,
                assigned_prescription_event_id: payload.assigned_prescription_event_id,
                linked_event_id: payload.linked_event_id
            })
        });
    },

    cancelAdministrationEvent: (prescriptionId: string, prescriptionEventId: string, adminEventId: string, cancellationReason?: string) => fetchJson<any>(`/prescriptions/${prescriptionId}/events/${prescriptionEventId}/admin/${adminEventId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancellationReason })
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
