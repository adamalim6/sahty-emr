import { globalQuery, globalQueryOne } from '../db/globalPg';
import { User } from '../models/auth';
import bcrypt from 'bcryptjs';

export class GlobalAdminService {
    private static instance: GlobalAdminService;

    public static getInstance(): GlobalAdminService {
        if (!GlobalAdminService.instance) {
            GlobalAdminService.instance = new GlobalAdminService();
        }
        return GlobalAdminService.instance;
    }

    private mapUser(admin: any): User {
        return {
            id: admin.id,
            tenantId: admin.client_id || 'GLOBAL',
            username: admin.username,
            password_hash: admin.password_hash,
            nom: admin.nom,
            prenom: admin.prenom,
            user_type: admin.user_type,
            role_code: admin.role_code || 'SUPER_ADMIN',
            role_id: admin.role_id,
            active: admin.active === true || admin.active === 1
        };
    }

    public async authenticate(username: string, password: string): Promise<User | null> {
        const admin = await globalQueryOne('SELECT * FROM users WHERE username = $1 AND active = TRUE', [username]);

        if (!admin) return null;

        const isValid = await bcrypt.compare(password, admin.password_hash);
        if (!isValid) return null;

        return this.mapUser(admin);
    }

    public async createGlobalAdmin(adminUser: User): Promise<User> {
        const existing = await globalQueryOne('SELECT id FROM users WHERE username = $1', [adminUser.username]);
        if (existing) {
            throw new Error("Username already exists in Global Realm");
        }

        await globalQuery(`
            INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_code, active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
        `, [
            adminUser.id, adminUser.username, adminUser.password_hash, adminUser.nom, adminUser.prenom, 
            adminUser.user_type, adminUser.role_code || 'SUPER_ADMIN', new Date().toISOString()
        ]);

        return adminUser;
    }
    
    public async getAdminById(id: string): Promise<User | undefined> {
        const admin = await globalQueryOne('SELECT * FROM users WHERE id = $1', [id]);
        if (!admin) return undefined;
        return this.mapUser(admin);
    }

    public async getGlobalRole(roleId: string): Promise<any> {
        const role = await globalQueryOne('SELECT * FROM global_roles WHERE id = $1', [roleId]);
        if (!role) return undefined;
        return {
            id: role.id,
            code: role.code, 
            name: role.name,
            permissions: role.permissions ? (typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions) : [],
            modules: role.modules ? (typeof role.modules === 'string' ? JSON.parse(role.modules) : role.modules) : [] 
        };
    }

    public async getAllGlobalRoles(): Promise<any[]> {
        const rows = await globalQuery('SELECT * FROM global_roles');
        return rows.map(role => ({
            id: role.id,
            code: role.code,
            name: role.name,
            description: role.description,
            permissions: role.permissions ? (typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions) : [],
            modules: role.modules ? (typeof role.modules === 'string' ? JSON.parse(role.modules) : role.modules) : [] 
        }));
    }

    public async createGlobalRole(roleData: { name: string; description?: string; permissions?: any[] }): Promise<any> {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        
        // Auto-generate code from name (UPPERCASE, no spaces, no accents)
        const code = roleData.name
            .toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        await globalQuery(`
            INSERT INTO global_roles (id, code, name, description, permissions, assignable_by)
            VALUES ($1, $2, $3, $4, $5, 'TENANT_ADMIN')
        `, [
            id,
            code,
            roleData.name,
            roleData.description || null,
            JSON.stringify(roleData.permissions || [])
        ]);
        
        return this.getGlobalRole(id);
    }

    public async updateGlobalRole(id: string, updates: any): Promise<any> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name) { fields.push(`name=$${paramIndex++}`); values.push(updates.name); }
        if (updates.permissions) { fields.push(`permissions=$${paramIndex++}`); values.push(JSON.stringify(updates.permissions)); }
        if (updates.modules) { fields.push(`modules=$${paramIndex++}`); values.push(JSON.stringify(updates.modules)); }
        
        if (fields.length > 0) {
            values.push(id);
            await globalQuery(`UPDATE global_roles SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
        return this.getGlobalRole(id);
    }

    // Tenant Admin Management
    public async getTenantAdmin(clientId: string): Promise<User | undefined> {
        const row = await globalQueryOne('SELECT * FROM users WHERE client_id = $1 AND user_type = $2', [clientId, 'TENANT_SUPERADMIN']);
        if (!row) return undefined;
        return this.mapUser(row);
    }

    public async createTenantAdmin(admin: Partial<User>): Promise<User> {
        // Import uuid lazily or assume it's available, but better to use import at top. 
        // We will just use the passed ID or generate a random one if needed.
        // Wait, I can't add imports easily here without affecting top of file.
        // I'll stick to 'uuid' if I can.
        // Actually, let's use standard crypto.randomUUID() if node 19+, or just require it.
        const { v4: uuidv4 } = require('uuid');
        
        const now = new Date().toISOString();
        const newId = admin.id || uuidv4();

        // Validate UUID for role_id
        const isUuid = (str?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
        const validRoleId = isUuid(admin.role_id) ? admin.role_id : null;

        await globalQuery(`
            INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_id, role_code, client_id, created_at, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
        `, [
            newId,
            admin.username,
            admin.password_hash,
            admin.nom || 'Admin',
            admin.prenom || 'Structure',
            'TENANT_SUPERADMIN',
            validRoleId,
            'ADMIN_STRUCTURE',
            admin.tenantId,
            now
        ]);

        return {
            ...admin,
            id: newId,
            user_type: 'TENANT_SUPERADMIN',
            role_code: 'ADMIN_STRUCTURE',
            active: true,
            tenantId: admin.tenantId
        } as User;
    }

    public async updateTenantAdmin(clientId: string, updates: Partial<User>): Promise<void> {
        const current = await this.getTenantAdmin(clientId);
        if (!current) {
            throw new Error("Tenant Admin not found");
        }

        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        
        if (updates.username) { fields.push(`username=$${paramIndex++}`); values.push(updates.username); }
        if (updates.password_hash) { fields.push(`password_hash=$${paramIndex++}`); values.push(updates.password_hash); }
        if (updates.nom) { fields.push(`nom=$${paramIndex++}`); values.push(updates.nom); }
        if (updates.prenom) { fields.push(`prenom=$${paramIndex++}`); values.push(updates.prenom); }
        
        if (fields.length > 0) {
            values.push(current.id);
            await globalQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
    }

    // --- Tenants Management ---
    public async getAllTenants(): Promise<any[]> {
        return globalQuery('SELECT * FROM tenants ORDER BY created_at DESC');
    }
    // Backwards-compat alias
    public async getAllClients(): Promise<any[]> { return this.getAllTenants(); }

    public async getTenantById(id: string): Promise<any> {
        return globalQueryOne('SELECT * FROM tenants WHERE id = $1', [id]);
    }
    public async getClientById(id: string): Promise<any> { return this.getTenantById(id); }

    public async createTenant(tenant: any): Promise<any> {
        const now = new Date().toISOString();
        
        await globalQuery(`
            INSERT INTO tenants (id, type, designation, siege_social, representant_legal, country, tenancy_mode, group_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        `, [
            tenant.id, 
            tenant.type, 
            tenant.designation, 
            tenant.siege_social, 
            tenant.representant_legal, 
            tenant.country || 'MAROC',
            tenant.tenancy_mode || 'STANDALONE',
            tenant.group_id || null,
            now
        ]);
        return tenant;
    }

    public async updateTenant(id: string, updates: any): Promise<any> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        
        if (updates.type) { fields.push(`type=$${paramIndex++}`); values.push(updates.type); }
        if (updates.designation) { fields.push(`designation=$${paramIndex++}`); values.push(updates.designation); }
        if (updates.siege_social) { fields.push(`siege_social=$${paramIndex++}`); values.push(updates.siege_social); }
        if (updates.representant_legal) { fields.push(`representant_legal=$${paramIndex++}`); values.push(updates.representant_legal); }
        if (updates.country) { fields.push(`country=$${paramIndex++}`); values.push(updates.country); }
        
        fields.push(`updated_at=$${paramIndex++}`);
        values.push(new Date().toISOString());

        if (fields.length > 0) {
            values.push(id);
            await globalQuery(`UPDATE tenants SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
        }
        return this.getTenantById(id);
    }
    
    public async deleteTenant(id: string): Promise<void> {
        await globalQuery('DELETE FROM tenants WHERE id = $1', [id]);
        await globalQuery('UPDATE users SET active = FALSE WHERE client_id = $1', [id]);
    }

    // --- Organismes Management ---
    public async getAllOrganismes(): Promise<any[]> {
        return globalQuery('SELECT * FROM organismes ORDER BY designation ASC');
    }

    public async createOrganisme(org: any): Promise<any> {
        const now = new Date().toISOString();

        await globalQuery(`
            INSERT INTO organismes (id, designation, category, sub_type, coefficient_b, active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        `, [
            org.id,
            org.designation,
            org.category,
            org.sub_type,
            org.coefficient_b || null,
            org.active !== false,
            now
        ]);
        return org;
    }

    public async updateOrganisme(id: string, updates: any): Promise<any> {
        const now = new Date().toISOString();
        await globalQuery(`
            UPDATE organismes SET designation = $2, category = $3, sub_type = $4, coefficient_b = $5, active = $6, updated_at = $7
            WHERE id = $1
        `, [id, updates.designation, updates.category, updates.sub_type, updates.coefficient_b || null, updates.active !== false, now]);
        return globalQuery('SELECT * FROM organismes WHERE id = $1', [id]).then(r => r[0]);
    }

    public async toggleOrganismeStatus(id: string, active: boolean): Promise<void> {
        await globalQuery('UPDATE organismes SET active = $2, updated_at = NOW() WHERE id = $1', [id, active]);
    }
}

export const globalAdminService = GlobalAdminService.getInstance();
