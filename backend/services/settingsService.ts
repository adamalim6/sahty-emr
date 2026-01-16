
import { TenantStore } from '../utils/tenantStore';
import { User, Role } from '../models/auth';

// Interfaces based on SettingsController logic
export interface ServiceDefinition {
    id: string;
    name: string;
    code: string;
    description?: string;
    tenantId?: string; // Redundant but good for object portability
}

export interface UnitType { // Was rooms.json
    id: string;
    name: string; // e.g. "Chambre Standard"
    description?: string;
    unit_category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION';
    number_of_beds?: number;
    tenantId?: string;
}

export interface ServiceUnit { // Was service_units.json - The actual instances (e.g. Room 101)
    id: string;
    service_id: string;
    unit_type_id: string;
    name: string; // e.g. "101"
    created_at: string;
    tenantId?: string;
    
    // EMR Compatibility fields (can be derived or stored)
    isOccupied?: boolean;
    section?: string; // Derived from Service?
    type?: string; // Derived from UnitType?
}

export interface Pricing {
    id: string;
    act_code: string;
    description: string;
    price: number;
    tenantId?: string;
}

interface SettingsData {
    users: User[];
    roles: Role[];
    services: ServiceDefinition[];
    unitTypes: UnitType[];
    serviceUnits: ServiceUnit[]; // This maps to EMR "Rooms"
    pricing: Pricing[];
    
    // Legacy mapping support:
    // If EMR expects "rooms", we might alias serviceUnits or specific "rooms" array?
    // EmrService refactor used 'rooms' property.
    // I will alias functionality: getRooms -> serviceUnits map
    // BUT EmrService accesses store.load('settings').rooms directly in my previous code!
    // So I MUST have a 'rooms' property in SettingsData OR update EmrService.
    // I will ADD 'rooms' property to SettingsData which Syncs with ServiceUnits or IS ServiceUnits.
    // EmrService expects Room interface: { id, number, isOccupied... }
    // ServiceUnit has { id, name, isOccupied... }
    // I'll stick to 'rooms' for EMR compatibility for now.
    rooms: any[]; // To match EmrService expectation: Room[]
}

const DEFAULT_SETTINGS: SettingsData = {
    users: [],
    roles: [],
    services: [],
    unitTypes: [],
    serviceUnits: [],
    pricing: [],
    rooms: [] 
};

export class SettingsService {
    
    private getStore(tenantId: string): TenantStore {
        return new TenantStore(tenantId);
    }

    private loadData(tenantId: string): SettingsData {
        return this.getStore(tenantId).load<SettingsData>('settings', DEFAULT_SETTINGS);
    }

    private saveData(tenantId: string, data: SettingsData) {
        this.getStore(tenantId).save('settings', data);
    }

    // --- USERS ---
    getUsers(tenantId: string): User[] {
        return this.loadData(tenantId).users;
    }

    createUser(tenantId: string, user: User): User {
        const data = this.loadData(tenantId);
        
        // 🔐 SAFETY RULE: SuperAdmin Containment
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        if (data.users.find(u => u.username === user.username)) {
            throw new Error('Username taken'); // Validation logic
        }

        // Validate Role and set Code
        const role = this.getGlobalRoleDefinition(user.role_id);
        if (!role) {
             // Fallback for tenant-local roles if we ever have them, or error
             // For now, assume all roles are global
             throw new Error(`Invalid Role ID: ${user.role_id}`);
        }
        user.role_code = role.code; // Ensure code is set for Auth context

        user.client_id = tenantId;
        data.users.push(user);
        this.saveData(tenantId, data);
        return user;
    }

    updateUser(tenantId: string, user: User): User {
        const data = this.loadData(tenantId);
        
        // 🔐 SAFETY RULE: SuperAdmin Containment
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
             throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        const idx = data.users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');
        
        // Merge updates
        data.users[idx] = { ...data.users[idx], ...user };
        this.saveData(tenantId, data);
        return data.users[idx];
    }

    // --- ROLES ---
    getRoles(tenantId: string): Role[] {
        return this.loadData(tenantId).roles;
    }

    // New method to fetch Global Definitions
    getGlobalRolesDefinitions(): Role[] {
        // We need to read from global/roles.json
        // Since GlobalStore is not fully exposed here (private util?), we can access it via helper or direct
        // Let's use the GlobalStore class available in imports if possible, or assume typical path
        // For safety, let's use a direct read or better, import GlobalStore in this file
        return require('../utils/tenantStore').GlobalStore.load('roles', []);
    }

    getGlobalRoleDefinition(id: string): Role | undefined {
        const roles = this.getGlobalRolesDefinitions();
        return roles.find(r => r.id === id);
    }

    // --- SERVICES ---
    getServices(tenantId: string): ServiceDefinition[] {
        return this.loadData(tenantId).services;
    }

    createService(tenantId: string, service: ServiceDefinition): ServiceDefinition {
        const data = this.loadData(tenantId);
        service.tenantId = tenantId;
        // Check dups
        if (data.services.find(s => s.name === service.name || s.code === service.code)) {
             throw new Error("Service name/code duplicate");
        }
        data.services.push(service);
        this.saveData(tenantId, data);
        return service;
    }

    updateService(tenantId: string, service: ServiceDefinition): ServiceDefinition {
        const data = this.loadData(tenantId);
        const idx = data.services.findIndex(s => s.id === service.id);
        if (idx === -1) throw new Error("Service not found");
        data.services[idx] = { ...data.services[idx], ...service };
        this.saveData(tenantId, data);
        return data.services[idx];
    }

    deleteService(tenantId: string, serviceId: string): void {
        const data = this.loadData(tenantId);
        data.services = data.services.filter(s => s.id !== serviceId);
        this.saveData(tenantId, data);
    }

    // --- UNIT TYPES (Room Definitions) ---
    getUnitTypes(tenantId: string): UnitType[] {
        return this.loadData(tenantId).unitTypes;
    }

    createUnitType(tenantId: string, unit: UnitType): UnitType {
        const data = this.loadData(tenantId);
        unit.tenantId = tenantId;
        data.unitTypes.push(unit);
        this.saveData(tenantId, data);
        return unit;
    }

    updateUnitType(tenantId: string, unit: UnitType): UnitType {
        const data = this.loadData(tenantId);
        const idx = data.unitTypes.findIndex(u => u.id === unit.id);
        if (idx !== -1) {
            data.unitTypes[idx] = { ...data.unitTypes[idx], ...unit };
            this.saveData(tenantId, data);
            return data.unitTypes[idx];
        }
        throw new Error("Unit Type not found");
    }

    deleteUnitType(tenantId: string, id: string): void {
        const data = this.loadData(tenantId);
        data.unitTypes = data.unitTypes.filter(u => u.id !== id);
        this.saveData(tenantId, data);
    }

    // --- SERVICE UNITS (Actual Rooms) & EMR ROOMS ---
    // We map Service Units to 'rooms' for EMR compatibility
    
    getRooms(tenantId: string): any[] {
        // Return 'rooms' which EmrService uses
        return this.loadData(tenantId).rooms;
    }
    
    // Method to sync/create room for EMR when ServiceUnit is created?
    // Or just expose serviceUnits as rooms?
    // Previously SettingsController managed service_units separately.
    // EmrService managed rooms separately.
    // We want to Unify? 
    // If I use 'rooms', EmrService works.
    // SettingsController uses 'serviceUnits'.
    // I should implement both separately to avoid breaking logic now, but maybe sync them?
    // Or just store them separately in same file.
    
    getServiceUnits(tenantId: string, serviceId?: string): ServiceUnit[] {
        const data = this.loadData(tenantId);
        if (serviceId) return data.serviceUnits.filter(u => u.service_id === serviceId);
        return data.serviceUnits;
    }

    createServiceUnit(tenantId: string, unit: ServiceUnit): ServiceUnit {
        const data = this.loadData(tenantId);
        unit.tenantId = tenantId;
        data.serviceUnits.push(unit);
        
        // Also add to 'rooms' for EMR visibility?
        // EMR Room: { id, number(name), section(service?), isOccupied: false }
        // Let's Auto-sync
        const emrRoom: any = {
            id: unit.id,
            number: unit.name,
            section: unit.service_id, // simplified
            isOccupied: false,
            // type: derived?
        };
        data.rooms.push(emrRoom);
        
        this.saveData(tenantId, data);
        return unit;
    }

    deleteServiceUnit(tenantId: string, unitId: string): void {
        const data = this.loadData(tenantId);
        data.serviceUnits = data.serviceUnits.filter(u => u.id !== unitId);
        data.rooms = data.rooms.filter(r => r.id !== unitId); // Sync delete
        this.saveData(tenantId, data);
    }

    // --- PRICING ---
    getPricing(tenantId: string): Pricing[] {
        return this.loadData(tenantId).pricing;
    }
    
    createPricing(tenantId: string, pricing: Pricing): Pricing {
        const data = this.loadData(tenantId);
        pricing.tenantId = tenantId;
        data.pricing.push(pricing);
        this.saveData(tenantId, data);
        return pricing;
    }
}

export const settingsService = new SettingsService();
