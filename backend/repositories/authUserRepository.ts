/**
 * AuthUserRepository - Unified User Data Access Layer
 * Abstracts access to users across:
 * - Global DB: sahty_global.public.users (SuperAdmins only)
 * - Tenant DBs: auth.users + auth.credentials + public.user_roles (tenant staff + tenant admins)
 */

import { globalQuery, globalQueryOne } from '../db/globalPg';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { User } from '../models/auth';
import { v4 as uuidv4 } from 'uuid';

type DataSource = 'global' | string; // 'global' or tenantId

class AuthUserRepository {
    private static instance: AuthUserRepository;

    public static getInstance(): AuthUserRepository {
        if (!AuthUserRepository.instance) {
            AuthUserRepository.instance = new AuthUserRepository();
        }
        return AuthUserRepository.instance;
    }

    /**
     * Map raw DB row from GLOBAL DB to User interface
     */
    private mapGlobalUser(row: any): User {
        return {
            id: row.id,
            tenantId: row.client_id || 'GLOBAL',
            username: row.username,
            password_hash: row.password_hash,
            nom: row.nom,
            prenom: row.prenom,
            user_type: row.user_type,
            role_code: row.role_code,
            role_id: row.role_id,
            active: row.active === true || row.active === 1,
            INPE: row.inpe,
            service_ids: row.service_ids
        };
    }

    /**
     * Map raw DB row from TENANT auth.* tables to User interface
     */
    private mapTenantAuthUser(row: any, tenantId: string): User {
        // Derive user_type from role_code (no longer stored in auth.users)
        const roleCode = row.role_code || null;
        const derivedUserType = (roleCode === 'TENANT_ADMIN' || roleCode === 'DSI' || roleCode === 'ADMIN_STRUCTURE')
            ? 'TENANT_SUPERADMIN' : 'TENANT_USER';

        return {
            id: row.user_id,
            tenantId: tenantId,
            username: row.username,
            password_hash: row.password_hash,
            nom: row.last_name || '',
            prenom: row.first_name || '',
            user_type: derivedUserType as any,
            role_code: roleCode,
            role_id: row.role_id || null,
            active: row.is_active === true,
            INPE: row.inpe,
            service_ids: row.service_ids || []
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // READ OPERATIONS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Find user by username
     */
    async findByUsername(username: string, source: DataSource): Promise<User | null> {
        if (source === 'global') {
            const row = await globalQueryOne(
                'SELECT * FROM users WHERE username = $1 AND active = TRUE',
                [username]
            );
            return row ? this.mapGlobalUser(row) : null;
        } else {
            const rows = await tenantQuery(
                source,
                `SELECT 
                    u.user_id, u.username, u.first_name, u.last_name, u.display_name,
                    u.inpe, u.is_active,
                    c.password_hash,
                    ur.role_id,
                    gr.code AS role_code,
                    COALESCE(
                        (SELECT json_agg(us.service_id) FROM public.user_services us WHERE us.user_id = u.user_id),
                        '[]'::json
                    ) AS service_ids
                FROM auth.users u
                JOIN auth.credentials c ON c.user_id = u.user_id
                LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
                LEFT JOIN reference.global_roles gr ON gr.id = ur.role_id
                WHERE u.username = $1 AND u.is_active = TRUE`,
                [username]
            );
            return rows.length > 0 ? this.mapTenantAuthUser(rows[0], source) : null;
        }
    }

    /**
     * Find user by ID
     */
    async findById(id: string, source: DataSource): Promise<User | null> {
        if (source === 'global') {
            const row = await globalQueryOne(
                'SELECT * FROM users WHERE id = $1',
                [id]
            );
            return row ? this.mapGlobalUser(row) : null;
        } else {
            const rows = await tenantQuery(
                source,
                `SELECT 
                    u.user_id, u.username, u.first_name, u.last_name, u.display_name,
                    u.inpe, u.is_active,
                    c.password_hash,
                    ur.role_id,
                    gr.code AS role_code,
                    COALESCE(
                        (SELECT json_agg(us.service_id) FROM public.user_services us WHERE us.user_id = u.user_id),
                        '[]'::json
                    ) AS service_ids
                FROM auth.users u
                JOIN auth.credentials c ON c.user_id = u.user_id
                LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
                LEFT JOIN reference.global_roles gr ON gr.id = ur.role_id
                WHERE u.user_id = $1`,
                [id]
            );
            return rows.length > 0 ? this.mapTenantAuthUser(rows[0], source) : null;
        }
    }

    /**
     * Find tenant admin by clientId (Global DB only)
     */
    async findTenantAdmin(clientId: string): Promise<User | null> {
        const row = await globalQueryOne(
            'SELECT * FROM users WHERE client_id = $1 AND user_type = $2',
            [clientId, 'TENANT_SUPERADMIN']
        );
        return row ? this.mapGlobalUser(row) : null;
    }

    /**
     * Find all users (Tenant DB — reads from auth.users)
     */
    async findAll(tenantId: string): Promise<User[]> {
        const rows = await tenantQuery(tenantId, `
            SELECT 
                u.user_id, u.username, u.first_name, u.last_name, u.display_name,
                u.inpe, u.is_active,
                c.password_hash,
                ur.role_id,
                gr.code AS role_code,
                COALESCE(
                    (SELECT json_agg(us.service_id) FROM public.user_services us WHERE us.user_id = u.user_id),
                    '[]'::json
                ) AS service_ids
            FROM auth.users u
            JOIN auth.credentials c ON c.user_id = u.user_id
            LEFT JOIN public.user_roles ur ON ur.user_id = u.user_id
            LEFT JOIN reference.global_roles gr ON gr.id = ur.role_id
            ORDER BY u.display_name
        `, []);
        return rows.map(r => this.mapTenantAuthUser(r, tenantId));
    }

    // ─────────────────────────────────────────────────────────────────
    // WRITE OPERATIONS
    // ─────────────────────────────────────────────────────────────────

    /**
     * Create a new user
     */
    async create(user: Partial<User>, source: DataSource): Promise<User> {
        const id = user.id || uuidv4();
        const now = new Date().toISOString();

        if (source === 'global') {
            // Global DB: Super Admins and Tenant Admins
            await globalQuery(`
                INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_id, role_code, client_id, created_at, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
            `, [
                id,
                user.username,
                user.password_hash,
                user.nom || '',
                user.prenom || '',
                user.user_type || 'SUPER_ADMIN',
                user.role_id || null,
                user.role_code || 'SUPER_ADMIN',
                user.tenantId && user.tenantId !== 'GLOBAL' ? user.tenantId : null,
                now
            ]);

            return { ...user, id, active: true } as User;
        } else {
            // Tenant DB: auth.users + auth.credentials + auth.user_tenants + public.user_roles
            const existing = await tenantQuery(
                source,
                'SELECT user_id FROM auth.users WHERE username = $1',
                [user.username]
            );
            if (existing.length > 0) {
                throw new Error('Username already exists');
            }

            const displayName = `${user.prenom || ''} ${user.nom || ''}`.trim() || (user.username as string);

            // 1. auth.users (no user_type/service_ids — those are in junction tables)
            await tenantQuery(source, `
                INSERT INTO auth.users (user_id, username, first_name, last_name, display_name, inpe, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, now(), now())
            `, [
                id,
                user.username,
                user.prenom || '',
                user.nom || '',
                displayName,
                (user.INPE || '').trim() || null
            ]);

            // 2. auth.credentials
            await tenantQuery(source, `
                INSERT INTO auth.credentials (user_id, password_hash, password_algo)
                VALUES ($1, $2, 'bcrypt')
            `, [id, user.password_hash]);

            // 3. auth.user_tenants
            await tenantQuery(source, `
                INSERT INTO auth.user_tenants (user_id, tenant_id, is_enabled)
                VALUES ($1, $2::uuid, TRUE)
            `, [id, source]);

            // 4. public.user_roles
            if (user.role_id) {
                await tenantQuery(source, `
                    INSERT INTO public.user_roles (user_id, role_id)
                    VALUES ($1, $2::uuid)
                    ON CONFLICT DO NOTHING
                `, [id, user.role_id]);
            }

            // 5. public.user_services
            if (user.service_ids && user.service_ids.length > 0) {
                for (const svcId of user.service_ids) {
                    await tenantQuery(source, `
                        INSERT INTO public.user_services (user_id, service_id)
                        VALUES ($1, $2::uuid)
                        ON CONFLICT DO NOTHING
                    `, [id, svcId]);
                }
            }

            return { ...user, id, tenantId: source, active: true } as User;
        }
    }

    /**
     * Update an existing user
     */
    async update(id: string, updates: Partial<User>, source: DataSource): Promise<User> {
        if (source === 'global') {
            const fields: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (updates.username) { fields.push(`username=$${paramIndex++}`); values.push(updates.username); }
            if (updates.password_hash) { fields.push(`password_hash=$${paramIndex++}`); values.push(updates.password_hash); }
            if (updates.nom) { fields.push(`nom=$${paramIndex++}`); values.push(updates.nom); }
            if (updates.prenom) { fields.push(`prenom=$${paramIndex++}`); values.push(updates.prenom); }
            if (updates.role_id !== undefined) { fields.push(`role_id=$${paramIndex++}`); values.push(updates.role_id); }
            if (updates.role_code) { fields.push(`role_code=$${paramIndex++}`); values.push(updates.role_code); }
            if (updates.user_type) { fields.push(`user_type=$${paramIndex++}`); values.push(updates.user_type); }
            if (updates.active !== undefined) { fields.push(`active=$${paramIndex++}`); values.push(updates.active); }

            if (fields.length > 0) {
                values.push(id);
                await globalQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
            }
        } else {
            // Tenant DB: update auth.users + auth.credentials + public.user_roles
            const authFields: string[] = [];
            const authValues: any[] = [];
            let idx = 1;

            if (updates.nom) { authFields.push(`last_name=$${idx++}`); authValues.push(updates.nom); }
            if (updates.prenom) { authFields.push(`first_name=$${idx++}`); authValues.push(updates.prenom); }
            if (updates.username) { authFields.push(`username=$${idx++}`); authValues.push(updates.username); }
            if (updates.INPE !== undefined) { authFields.push(`inpe=$${idx++}`); authValues.push((updates.INPE || '').trim() || null); }
            if (updates.active !== undefined) { authFields.push(`is_active=$${idx++}`); authValues.push(updates.active); }

            if (updates.nom || updates.prenom) {
                const displayName = `${updates.prenom || ''} ${updates.nom || ''}`.trim();
                if (displayName) { authFields.push(`display_name=$${idx++}`); authValues.push(displayName); }
            }

            authFields.push(`updated_at=now()`);

            if (authFields.length > 0) {
                authValues.push(id);
                await tenantQuery(source, `UPDATE auth.users SET ${authFields.join(', ')} WHERE user_id = $${idx}`, authValues);
            }

            // Update password if provided
            if (updates.password_hash) {
                await tenantQuery(source, `
                    UPDATE auth.credentials SET password_hash = $1, updated_at = now() WHERE user_id = $2
                `, [updates.password_hash, id]);
            }

            // Update role if provided
            if (updates.role_id !== undefined) {
                await tenantQuery(source, 'DELETE FROM public.user_roles WHERE user_id = $1', [id]);
                if (updates.role_id) {
                    await tenantQuery(source, `
                        INSERT INTO public.user_roles (user_id, role_id)
                        VALUES ($1, $2::uuid)
                    `, [id, updates.role_id]);
                }
            }

            // Update service assignments if provided
            if (updates.service_ids !== undefined) {
                await tenantQuery(source, 'DELETE FROM public.user_services WHERE user_id = $1', [id]);
                if (updates.service_ids && updates.service_ids.length > 0) {
                    for (const svcId of updates.service_ids) {
                        await tenantQuery(source, `
                            INSERT INTO public.user_services (user_id, service_id)
                            VALUES ($1, $2::uuid)
                            ON CONFLICT DO NOTHING
                        `, [id, svcId]);
                    }
                }
            }
        }

        const updated = await this.findById(id, source);
        if (!updated) throw new Error('User not found after update');
        return updated;
    }

    /**
     * Deactivate user (soft delete)
     */
    async deactivate(id: string, source: DataSource): Promise<void> {
        if (source === 'global') {
            await globalQuery('UPDATE users SET active = FALSE WHERE id = $1', [id]);
        } else {
            await tenantQuery(source, 'UPDATE auth.users SET is_active = FALSE, updated_at = now() WHERE user_id = $1', [id]);
        }
    }
}

export const authUserRepository = AuthUserRepository.getInstance();
