/**
 * AuthUserRepository - Unified User Data Access Layer
 * Abstracts access to users table across both Global and Tenant databases.
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
     * Map raw DB row to User interface
     */
    private mapUser(row: any, source: DataSource): User {
        return {
            id: row.id,
            tenantId: source === 'global' ? (row.client_id || 'GLOBAL') : source,
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
            return row ? this.mapUser(row, source) : null;
        } else {
            const rows = await tenantQuery(
                source,
                'SELECT * FROM users WHERE username = $1 AND active = TRUE',
                [username]
            );
            return rows.length > 0 ? this.mapUser(rows[0], source) : null;
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
            return row ? this.mapUser(row, source) : null;
        } else {
            const rows = await tenantQuery(
                source,
                'SELECT * FROM users WHERE id = $1',
                [id]
            );
            return rows.length > 0 ? this.mapUser(rows[0], source) : null;
        }
    }

    /**
     * Find tenant admin by client_id (Global DB only)
     */
    async findTenantAdmin(clientId: string): Promise<User | null> {
        const row = await globalQueryOne(
            'SELECT * FROM users WHERE client_id = $1 AND user_type = $2',
            [clientId, 'TENANT_SUPERADMIN']
        );
        return row ? this.mapUser(row, 'global') : null;
    }

    /**
     * Find all users (Tenant DB only)
     */
    async findAll(tenantId: string): Promise<User[]> {
        const rows = await tenantQuery(tenantId, 'SELECT * FROM users', []);
        return rows.map(r => this.mapUser(r, tenantId));
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
            // Tenant DB: Regular users
            const existing = await tenantQuery(
                source,
                'SELECT id FROM users WHERE username = $1',
                [user.username]
            );
            if (existing.length > 0) {
                throw new Error('Username already exists');
            }

            await tenantQuery(source, `
                INSERT INTO users (id, tenant_id, username, password_hash, nom, prenom, user_type, role_id, inpe, service_ids, active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
            `, [
                id,
                source, // tenant_id
                user.username,
                user.password_hash,
                user.nom || '',
                user.prenom || '',
                user.user_type || 'USER',
                user.role_id || null,
                user.INPE || null,
                user.service_ids ? JSON.stringify(user.service_ids) : null
            ]);

            return { ...user, id, tenantId: source, active: true } as User;
        }
    }

    /**
     * Update an existing user
     */
    async update(id: string, updates: Partial<User>, source: DataSource): Promise<User> {
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
        if (updates.INPE !== undefined) { fields.push(`inpe=$${paramIndex++}`); values.push(updates.INPE); }
        if (updates.service_ids !== undefined) { 
            fields.push(`service_ids=$${paramIndex++}`); 
            values.push(JSON.stringify(updates.service_ids)); 
        }

        if (fields.length === 0) {
            const existing = await this.findById(id, source);
            if (!existing) throw new Error('User not found');
            return existing;
        }

        values.push(id);

        if (source === 'global') {
            await globalQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        } else {
            await tenantQuery(source, `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
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
            await tenantQuery(source, 'UPDATE users SET active = FALSE WHERE id = $1', [id]);
        }
    }
}

export const authUserRepository = AuthUserRepository.getInstance();
