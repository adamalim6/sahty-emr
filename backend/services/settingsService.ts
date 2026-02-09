/**
 * Settings Service - PostgreSQL Version
 * Manages users, roles, services, units, rooms, and pricing for tenants
 */

import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { User, Role } from '../models/auth';

// Interfaces
export interface ServiceDefinition {
    id: string;
    name: string;
    code: string;
    description?: string;
    tenantId?: string; 
}

export interface UnitType { 
    id: string;
    name: string; 
    description?: string;
    unit_category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION';
    number_of_beds?: number;
    tenantId?: string;
}

export interface ServiceUnit { 
    id: string;
    service_id: string;
    unit_type_id: string;
    name: string; 
    created_at: string;
    tenantId?: string;
    isOccupied?: boolean;
    section?: string; 
    type?: string; 
}

export interface Pricing {
    id: string;
    act_code: string;
    description: string;
    price: number;
    tenantId?: string;
}

export interface Room {
    id: string;
    service_id: string;
    number: string;
    section: string;
    is_occupied: boolean;
    type: string;
}

export class SettingsService {

    // --- USERS ---
    async getUsers(tenantId: string): Promise<User[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM users', []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id || r.client_id,
            username: r.username,
            password_hash: r.password_hash,
            nom: r.nom,
            prenom: r.prenom,
            user_type: r.user_type,
            role_id: r.role_id,
            active: r.active,
            service_ids: r.service_ids ? (typeof r.service_ids === 'string' ? JSON.parse(r.service_ids) : r.service_ids) : [],
            INPE: r.inpe
        }));
    }

    async createUser(tenantId: string, user: User): Promise<User> {
        // 🔐 SAFETY RULE: SuperAdmin Containment
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        // Check duplicate
        const existing = await tenantQuery(tenantId, 'SELECT id FROM users WHERE username = $1', [user.username]);
        if (existing.length > 0) throw new Error('Username taken');

        user.tenantId = tenantId;
        
        await tenantQuery(tenantId, `
            INSERT INTO users (id, tenant_id, username, password_hash, nom, prenom, user_type, role_id, inpe, service_ids, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            user.id, user.tenantId, user.username, user.password_hash, user.nom, user.prenom, 
            user.user_type, user.role_id, user.INPE || null, JSON.stringify(user.service_ids || []), 
            user.active !== false
        ]);

        return user;
    }

    async updateUser(tenantId: string, user: User): Promise<User> {
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }
        
        await tenantQuery(tenantId, `
            UPDATE users SET nom=$1, prenom=$2, user_type=$3, role_id=$4, inpe=$5, service_ids=$6, active=$7
            WHERE id=$8
        `, [
            user.nom, user.prenom, user.user_type, user.role_id, user.INPE || null, 
            JSON.stringify(user.service_ids || []), user.active !== false,
            user.id
        ]);

        return user;
    }

    // --- ROLES (read from reference.global_roles — replicated from sahty_global) ---
    async getRoles(tenantId: string): Promise<Role[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM reference.global_roles', []);
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            code: r.code,
            description: r.description,
            permissions: r.permissions ? (typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions) : [],
            modules: r.modules ? (typeof r.modules === 'string' ? JSON.parse(r.modules) : r.modules) : [],
            assignable_by: r.assignable_by
        }));
    }
    
    // --- SERVICES ---
    async getServices(tenantId: string): Promise<ServiceDefinition[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM services', []);
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            name: r.name,
            code: r.code,
            description: r.description
        }));
    }

    async createService(tenantId: string, service: ServiceDefinition): Promise<ServiceDefinition> {
        service.tenantId = tenantId;
        
        await tenantQuery(tenantId, `
            INSERT INTO services (id, tenant_id, name, code, description)
            VALUES ($1, $2, $3, $4, $5)
        `, [service.id, service.tenantId, service.name, service.code, service.description]);

        return service;
    }

    async updateService(tenantId: string, service: ServiceDefinition): Promise<ServiceDefinition> {
        await tenantQuery(tenantId, 
            `UPDATE services SET name=$1, code=$2, description=$3 WHERE id=$4`, 
            [service.name, service.code, service.description, service.id]
        );
        return service;
    }

    async deleteService(tenantId: string, serviceId: string): Promise<void> {
        await tenantQuery(tenantId, 'DELETE FROM services WHERE id=$1', [serviceId]);
    }

    // --- UNIT TYPES ---
    async getUnitTypes(tenantId: string): Promise<UnitType[]> {
        return []; 
    }
    
    async createUnitType(tenantId: string, unit: UnitType): Promise<UnitType> { return unit; }
    async updateUnitType(tenantId: string, unit: UnitType): Promise<UnitType> { return unit; }
    async deleteUnitType(tenantId: string, id: string): Promise<void> {}

    // --- SERVICE UNITS & ROOMS ---
    
    async getRooms(tenantId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM rooms', []);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            number: r.number,
            section: r.section,
            is_occupied: r.is_occupied,
            type: r.type
        }));
    }

    async createServiceUnit(tenantId: string, unit: ServiceUnit): Promise<ServiceUnit> {
        await tenantTransaction(tenantId, async (client) => {
            // Save to service_units
            await client.query(`
                INSERT INTO service_units (id, service_id, name, type)
                VALUES ($1, $2, $3, $4)
            `, [unit.id, unit.service_id, unit.name, unit.type]);
            
            // Auto-create Room
            await client.query(`
                INSERT INTO rooms (id, service_id, number, section, is_occupied, type)
                VALUES ($1, $2, $3, $4, false, $5)
            `, [unit.id, unit.service_id, unit.name, unit.service_id, unit.type]);
        });

        return unit;
    }

    async deleteServiceUnit(tenantId: string, unitId: string): Promise<void> {
        await tenantTransaction(tenantId, async (client) => {
            await client.query('DELETE FROM service_units WHERE id=$1', [unitId]);
            await client.query('DELETE FROM rooms WHERE id=$1', [unitId]);
        });
    }
    
    async getServiceUnits(tenantId: string, serviceId?: string): Promise<ServiceUnit[]> {
        let sql = 'SELECT * FROM service_units';
        let params: any[] = [];
        if (serviceId) {
            sql += ' WHERE service_id = $1';
            params.push(serviceId);
        }
        const rows = await tenantQuery(tenantId, sql, params);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            unit_type_id: '',
            name: r.name,
            created_at: new Date().toISOString(),
            tenantId: tenantId,
            type: r.type
        }));
    }

    // --- PRICING (Actes) ---
    async getPricing(tenantId: string): Promise<Pricing[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM actes', []);
        return rows.map(r => ({
            id: r.id,
            act_code: r.code,
            description: r.designation,
            price: r.price,
            tenantId: r.tenant_id
        }));
    }
    
    async createPricing(tenantId: string, pricing: Pricing): Promise<Pricing> {
        await tenantQuery(tenantId, `
            INSERT INTO actes (id, tenant_id, code, designation, price)
            VALUES ($1, $2, $3, $4, $5)
        `, [pricing.id, tenantId, pricing.act_code, pricing.description, pricing.price]);
        return pricing;
    }
}

export const settingsService = new SettingsService();
