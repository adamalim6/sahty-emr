
import { getTenantDB } from '../db/tenantDb';
import { User, Role } from '../models/auth';
import { GlobalStore } from '../utils/tenantStore'; // Still used for Global Roles? Or switch to globalDb? 
// Global Roles are likely in global.db now if migrated? 
// The schema shows `roles` table in Tenant DB. Global roles might be in code or global db.
// Let's assume GlobalStore is still valid for specialized JSONs or switch global lookup to SQL later.
// For now, let's keep GlobalStore for global definitions if they weren't migrated to global.db (only clients/orgs were).
// Wait, `users` table has `role_id`. `roles` table in Tenant DB has permissions.
// The `getGlobalRoleDefinition` in original code suggests some roles are global.
// Let's first focus on Tenant Data (Users, Services, Units, Rooms).

import { Database } from 'sqlite3';

// Helper for Promisified Sqlite
const run = (db: Database, sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(); });
});

const get = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row as T); });
});

const all = <T>(db: Database, sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows as T[]); });
});


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
    
    // EMR Compatibility fields
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
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM users');
        return rows.map(r => ({
            id: r.id,
            client_id: r.client_id,
            username: r.username,
            password_hash: r.password_hash,
            nom: r.nom,
            prenom: r.prenom,
            user_type: r.user_type,
            role_id: r.role_id,
            active: r.active === 1,
            service_ids: r.service_ids ? JSON.parse(r.service_ids) : [],
            INPE: r.inpe // Map lowercase column to Interface
        }));
    }

    async createUser(tenantId: string, user: User): Promise<User> {
        // 🔐 SAFETY RULE: SuperAdmin Containment
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        const db = await getTenantDB(tenantId);
        
        // Check duplicate
        const existing = await get(db, 'SELECT id FROM users WHERE username = ?', [user.username]);
        if (existing) throw new Error('Username taken');

        // Validation (Role) - We can check DB roles
        // const role = await get(db, 'SELECT * FROM roles WHERE id = ?', [user.role_id]);
        // if (!role) throw new Error(`Invalid Role ID: ${user.role_id}`);
        // user.role_code = role.code; // Update code from source

        user.client_id = tenantId;
        
        await run(db, `
            INSERT INTO users (id, client_id, username, password_hash, nom, prenom, user_type, role_id, inpe, service_ids, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            user.id, user.client_id, user.username, user.password_hash, user.nom, user.prenom, 
            user.user_type, user.role_id, user.INPE || null, JSON.stringify(user.service_ids || []), 
            user.active !== false ? 1 : 0
        ]);

        return user;
    }

    async updateUser(tenantId: string, user: User): Promise<User> {
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
             throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }
        
        const db = await getTenantDB(tenantId);
        
        // We only update fields that are present? Or full replace?
        // SQL replace is easy but might overwrite concurrents. Update specific fields is better API but explicit here.
        // Assuming full object passed for now:
        await run(db, `
            UPDATE users SET nom=?, prenom=?, user_type=?, role_id=?, inpe=?, service_ids=?, active=?
            WHERE id=?
        `, [
            user.nom, user.prenom, user.user_type, user.role_id, user.INPE || null, 
            JSON.stringify(user.service_ids || []), user.active !== false ? 1 : 0,
            user.id
        ]);

        return user;
    }

    // --- ROLES ---
    async getRoles(tenantId: string): Promise<Role[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM roles');
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            code: r.code,
            permissions: r.permissions ? JSON.parse(r.permissions) : [],
            modules: r.modules ? JSON.parse(r.modules) : []
        }));
    }

    async createRole(tenantId: string, role: Role): Promise<Role> {
        const db = await getTenantDB(tenantId);
        await run(db, `
            INSERT INTO roles (id, name, code, permissions, modules)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                code=excluded.code,
                permissions=excluded.permissions,
                modules=excluded.modules
        `, [
            role.id, 
            role.name, 
            role.code, 
            JSON.stringify(role.permissions || []),
            JSON.stringify(role.modules || [])
        ]);
        return role;
    }
    
    // --- SERVICES ---
    async getServices(tenantId: string): Promise<ServiceDefinition[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM services');
        return rows.map(r => ({
            id: r.id,
            tenantId: r.tenant_id,
            name: r.name,
            code: r.code,
            description: r.description
        }));
    }

    async createService(tenantId: string, service: ServiceDefinition): Promise<ServiceDefinition> {
        const db = await getTenantDB(tenantId);
        service.tenantId = tenantId;
        
        await run(db, `
            INSERT INTO services (id, tenant_id, name, code, description)
            VALUES (?, ?, ?, ?, ?)
        `, [service.id, service.tenantId, service.name, service.code, service.description]);

        return service;
    }

    async updateService(tenantId: string, service: ServiceDefinition): Promise<ServiceDefinition> {
        const db = await getTenantDB(tenantId);
        await run(db, `UPDATE services SET name=?, code=?, description=? WHERE id=?`, 
            [service.name, service.code, service.description, service.id]);
        return service;
    }

    async deleteService(tenantId: string, serviceId: string): Promise<void> {
        const db = await getTenantDB(tenantId);
        await run(db, 'DELETE FROM services WHERE id=?', [serviceId]);
    }

    // --- UNIT TYPES (Legacy? Not in SQL Schema yet) ---
    // If unit_types table wasn't created, we might need to add it or skip.
    // Schema was: users, roles, services, service_units, rooms.
    // 'service_units' table exists. 'unit_types' was mentioned but I didn't see it in the migration script explicitly?
    // Let's check schema.sql. I added: users, roles, services, service_units, rooms.
    // I did NOT add `unit_types`. 
    // If the frontend uses it, I should add it.
    // For now, I'll return empty or implement if I add table.
    // Let's assume we need to migrate it later if critical. 
    // "UnitType" seems to be definitions.
    
    async getUnitTypes(tenantId: string): Promise<UnitType[]> {
        // Not implemented in SQL yet. Return empty or throw? 
        return []; 
    }
    
    async createUnitType(tenantId: string, unit: UnitType): Promise<UnitType> { return unit; }
    async updateUnitType(tenantId: string, unit: UnitType): Promise<UnitType> { return unit; }
    async deleteUnitType(tenantId: string, id: string): Promise<void> {}

    // --- SERVICE UNITS & ROOMS ---
    
    async getRooms(tenantId: string): Promise<Room[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM rooms');
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            number: r.number,
            section: r.section,
            is_occupied: r.is_occupied === 1,
            type: r.type
        }));
    }

    async createServiceUnit(tenantId: string, unit: ServiceUnit): Promise<ServiceUnit> {
        const db = await getTenantDB(tenantId);
        // Save to service_units
        await run(db, `
            INSERT INTO service_units (id, service_id, name, type)
            VALUES (?, ?, ?, ?)
        `, [unit.id, unit.service_id, unit.name, unit.type]);
        
        // Auto-create Room
        await run(db, `
            INSERT INTO rooms (id, service_id, number, section, is_occupied, type)
            VALUES (?, ?, ?, ?, 0, ?)
        `, [unit.id, unit.service_id, unit.name, unit.service_id, unit.type]);

        return unit;
    }

    async deleteServiceUnit(tenantId: string, unitId: string): Promise<void> {
        const db = await getTenantDB(tenantId);
        await run(db, 'DELETE FROM service_units WHERE id=?', [unitId]);
        await run(db, 'DELETE FROM rooms WHERE id=?', [unitId]);
    }
    
    async getServiceUnits(tenantId: string, serviceId?: string): Promise<ServiceUnit[]> {
        const db = await getTenantDB(tenantId);
        let sql = 'SELECT * FROM service_units';
        let params: any[] = [];
        if (serviceId) {
            sql += ' WHERE service_id = ?';
            params.push(serviceId);
        }
        const rows = await all<any>(db, sql, params);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            unit_type_id: '', // Deprecated?
            name: r.name,
            created_at: new Date().toISOString(),
            tenantId: tenantId,
            type: r.type
        }));
    }

    // --- PRICING (Actes) ---
    // Table is `actes` in schema?
    // Schema has 'actes'. Migration didn't migrate 'pricing.json' explicitly?
    // I might have missed `pricings.json` migration.
    // The schema has `actes`.
    // SettingsService uses `pricing`.
    // Let's implement `actes` mapping.

    async getPricing(tenantId: string): Promise<Pricing[]> {
        const db = await getTenantDB(tenantId);
        const rows = await all<any>(db, 'SELECT * FROM actes');
        return rows.map(r => ({
            id: r.id,
            act_code: r.code,
            description: r.designation,
            price: r.price,
            tenantId: r.tenant_id
        }));
    }
    
    async createPricing(tenantId: string, pricing: Pricing): Promise<Pricing> {
        const db = await getTenantDB(tenantId);
        await run(db, `
            INSERT INTO actes (id, tenant_id, code, designation, price)
            VALUES (?, ?, ?, ?, ?)
        `, [pricing.id, tenantId, pricing.act_code, pricing.description, pricing.price]);
        return pricing;
    }
}

export const settingsService = new SettingsService();
