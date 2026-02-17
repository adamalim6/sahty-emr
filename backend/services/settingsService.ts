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

    // --- USERS (reads from auth.* + public.user_roles) ---
    async getUsers(tenantId: string): Promise<User[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT 
                u.user_id AS id, u.username, u.first_name, u.last_name, u.display_name,
                u.inpe, u.is_active AS active,
                ur.role_id,
                gr.code AS role_code,
                COALESCE(
                    (SELECT json_agg(us.service_id) FROM public.user_services us WHERE us.user_id = u.user_id),
                    '[]'::json
                ) AS service_ids
            FROM auth.users u
            LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
            LEFT JOIN reference.global_roles gr ON gr.id = ur.role_id
            ORDER BY u.display_name
        `, []);
        return rows.map(r => {
            const roleCode = r.role_code || null;
            const derivedUserType = (roleCode === 'TENANT_ADMIN' || roleCode === 'DSI' || roleCode === 'ADMIN_STRUCTURE')
                ? 'TENANT_SUPERADMIN' : 'TENANT_USER';
            return {
                id: r.id,
                tenantId: tenantId,
                username: r.username,
                password_hash: '', // never expose
                nom: r.last_name || '',
                prenom: r.first_name || '',
                user_type: derivedUserType as any,
                role_id: r.role_id,
                role_code: roleCode,
                active: r.active,
                service_ids: r.service_ids || [],
                INPE: r.inpe
            };
        });
    }

    async createUser(tenantId: string, user: User): Promise<User> {
        // 🔐 SAFETY RULE: SuperAdmin Containment
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        // Check duplicate in auth.users
        const existing = await tenantQuery(tenantId, 'SELECT user_id FROM auth.users WHERE username = $1', [user.username]);
        if (existing.length > 0) throw new Error('Username taken');

        user.tenantId = tenantId;
        const displayName = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.username;

        // 1. auth.users (no user_type/service_ids — those are in junction tables)
        await tenantQuery(tenantId, `
            INSERT INTO auth.users (user_id, username, first_name, last_name, display_name, inpe, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
        `, [
            user.id, user.username, user.prenom || '', user.nom || '', displayName,
            user.INPE || null,
            user.active !== false
        ]);

        // 2. auth.credentials
        await tenantQuery(tenantId, `
            INSERT INTO auth.credentials (user_id, password_hash, password_algo)
            VALUES ($1, $2, 'bcrypt')
        `, [user.id, user.password_hash]);

        // 3. auth.user_tenants
        await tenantQuery(tenantId, `
            INSERT INTO auth.user_tenants (user_id, tenant_id, is_enabled)
            VALUES ($1, $2::uuid, TRUE)
        `, [user.id, tenantId]);

        // 4. public.user_roles
        if (user.role_id) {
            await tenantQuery(tenantId, `
                INSERT INTO public.user_roles (user_id, role_id)
                VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING
            `, [user.id, user.role_id]);
        }

        // 5. public.user_services
        if (user.service_ids && user.service_ids.length > 0) {
            for (const svcId of user.service_ids) {
                await tenantQuery(tenantId, `
                    INSERT INTO public.user_services (user_id, service_id)
                    VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING
                `, [user.id, svcId]);
            }
        }

        return user;
    }

    async updateUser(tenantId: string, user: User): Promise<User> {
        if (user.role_code === 'SUPER_ADMIN' || user.role_id === 'role_super_admin') {
            throw new Error("SECURITY VIOLATION: SUPER_ADMIN role is reserved for Global Realm and cannot be created in a Tenant.");
        }

        const displayName = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.username;

        // 1. Update auth.users (no user_type/service_ids — those are in junction tables)
        await tenantQuery(tenantId, `
            UPDATE auth.users SET 
                first_name=$1, last_name=$2, display_name=$3, inpe=$4, 
                is_active=$5, updated_at=now()
            WHERE user_id=$6
        `, [
            user.prenom || '', user.nom || '', displayName, user.INPE || null,
            user.active !== false, user.id
        ]);

        // 2. Update public.user_roles
        await tenantQuery(tenantId, 'DELETE FROM public.user_roles WHERE user_id = $1', [user.id]);
        if (user.role_id) {
            await tenantQuery(tenantId, `
                INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2::uuid)
            `, [user.id, user.role_id]);
        }

        // 3. Update public.user_services
        await tenantQuery(tenantId, 'DELETE FROM public.user_services WHERE user_id = $1', [user.id]);
        if (user.service_ids && user.service_ids.length > 0) {
            for (const svcId of user.service_ids) {
                await tenantQuery(tenantId, `
                    INSERT INTO public.user_services (user_id, service_id)
                    VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING
                `, [user.id, svcId]);
            }
        }

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

    // --- ROOM TYPES (maps to UI: Paramétrage → Chambres → Types de chambres) ---
    async getUnitTypes(tenantId: string): Promise<UnitType[]> {
        const rows = await tenantQuery(tenantId,
            `SELECT * FROM room_types WHERE is_active = true ORDER BY name`);
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            unit_category: r.unit_category,
            number_of_beds: r.number_of_beds,
        }));
    }
    
    async createUnitType(tenantId: string, unit: UnitType): Promise<UnitType> {
        const rows = await tenantQuery(tenantId, `
            INSERT INTO room_types (name, description, number_of_beds)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [unit.name, unit.description || null, unit.number_of_beds || 1]);
        const r = rows[0];
        return { id: r.id, name: r.name, description: r.description, number_of_beds: r.number_of_beds };
    }

    async updateUnitType(tenantId: string, unit: UnitType): Promise<UnitType> {
        const rows = await tenantQuery(tenantId, `
            UPDATE room_types SET name = $2, description = $3, number_of_beds = $4
            WHERE id = $1 AND is_active = true
            RETURNING *
        `, [unit.id, unit.name, unit.description || null, unit.number_of_beds || null]);
        if (rows.length === 0) throw new Error('Room type not found');
        const r = rows[0];
        return { id: r.id, name: r.name, description: r.description, number_of_beds: r.number_of_beds };
    }

    async deleteUnitType(tenantId: string, id: string): Promise<void> {
        // Soft-delete: set is_active = false
        await tenantQuery(tenantId, `UPDATE room_types SET is_active = false WHERE id = $1`, [id]);
    }

    // --- SERVICE UNITS & ROOMS ---
    
    async getRooms(tenantId: string): Promise<Room[]> {
        const rows = await tenantQuery(tenantId,
            `SELECT r.*, rt.name AS room_type_name FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id WHERE r.is_active = true ORDER BY r.name`, []);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            number: r.name,
            section: r.room_type_name,
            is_occupied: false, // derived from beds now
            type: r.room_type_name
        }));
    }

    /**
     * Create a room + its beds in a single atomic transaction.
     * Reads number_of_beds from the room_type and auto-creates that many beds.
     */
    async createServiceUnit(tenantId: string, unit: ServiceUnit): Promise<ServiceUnit> {
        const result = await tenantTransaction(tenantId, async (client) => {
            // 1. Look up the room type to get number_of_beds
            const rtRows = await client.query(
                'SELECT id, name, number_of_beds FROM room_types WHERE id = $1 AND is_active = true',
                [unit.unit_type_id]
            );
            if (rtRows.rows.length === 0) {
                throw new Error('Type de chambre introuvable ou inactif');
            }
            const roomType = rtRows.rows[0];
            const numberOfBeds = roomType.number_of_beds || 1;

            // 2. Insert the room
            const roomRows = await client.query(`
                INSERT INTO rooms (id, service_id, room_type_id, name, is_active)
                VALUES (gen_random_uuid(), $1, $2, $3, true)
                RETURNING *
            `, [unit.service_id, unit.unit_type_id, unit.name]);
            const room = roomRows.rows[0];

            // 3. Auto-create beds
            for (let i = 1; i <= numberOfBeds; i++) {
                await client.query(`
                    INSERT INTO beds (id, room_id, label, status)
                    VALUES (gen_random_uuid(), $1, $2, 'AVAILABLE')
                `, [room.id, `Lit ${i}`]);
            }

            return {
                id: room.id,
                service_id: room.service_id,
                unit_type_id: room.room_type_id,
                name: room.name,
                created_at: room.created_at,
                tenantId,
            };
        });

        return result;
    }

    async deleteServiceUnit(tenantId: string, unitId: string): Promise<void> {
        await tenantTransaction(tenantId, async (client) => {
            // Check if ANY beds have ever been linked to patient_stays (past or present)
            const anyStays = await client.query(`
                SELECT ps.id FROM patient_stays ps
                JOIN beds b ON b.id = ps.bed_id
                WHERE b.room_id = $1
                LIMIT 1
            `, [unitId]);
            if (anyStays.rows.length > 0) {
                throw new Error('Impossible de supprimer : cette chambre a un historique de séjours. Utilisez la désactivation.');
            }
            // No history — hard delete beds then room
            await client.query('DELETE FROM beds WHERE room_id = $1', [unitId]);
            await client.query('DELETE FROM rooms WHERE id = $1', [unitId]);
        });
    }

    async deactivateServiceUnit(tenantId: string, unitId: string): Promise<void> {
        await tenantTransaction(tenantId, async (client) => {
            // Check no ACTIVE stays (cannot deactivate while patients are in the room)
            const activeStays = await client.query(`
                SELECT ps.id FROM patient_stays ps
                JOIN beds b ON b.id = ps.bed_id
                WHERE b.room_id = $1 AND ps.ended_at IS NULL
                LIMIT 1
            `, [unitId]);
            if (activeStays.rows.length > 0) {
                throw new Error('Impossible de désactiver : des patients occupent cette chambre');
            }
            // Soft-deactivate beds (status=INACTIVE) then room (is_active=false)
            await client.query("UPDATE beds SET status = 'INACTIVE' WHERE room_id = $1", [unitId]);
            await client.query('UPDATE rooms SET is_active = false WHERE id = $1', [unitId]);
        });
    }

    async reactivateServiceUnit(tenantId: string, unitId: string): Promise<void> {
        await tenantTransaction(tenantId, async (client) => {
            await client.query('UPDATE rooms SET is_active = true WHERE id = $1', [unitId]);
            await client.query("UPDATE beds SET status = 'AVAILABLE' WHERE room_id = $1 AND status = 'INACTIVE'", [unitId]);
        });
    }

    async getServiceUnits(tenantId: string, serviceId?: string): Promise<ServiceUnit[]> {
        let sql = `
            SELECT r.id, r.service_id, r.room_type_id as unit_type_id, r.name, r.is_active,
                   EXISTS(
                       SELECT 1 FROM patient_stays ps
                       JOIN beds b ON b.id = ps.bed_id
                       WHERE b.room_id = r.id
                   ) AS has_stays
            FROM rooms r
            WHERE 1=1
        `;
        const params: any[] = [];
        if (serviceId) {
            sql += ' AND r.service_id = $1';
            params.push(serviceId);
        }
        sql += ' ORDER BY r.is_active DESC, r.name';
        const rows = await tenantQuery(tenantId, sql, params);
        return rows.map(r => ({
            id: r.id,
            service_id: r.service_id,
            unit_type_id: r.unit_type_id,
            name: r.name,
            is_active: r.is_active,
            has_stays: r.has_stays,
            created_at: new Date().toISOString(),
            tenantId,
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
