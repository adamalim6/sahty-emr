import { getGlobalDB } from '../db/globalDb';
import { User } from '../models/auth';
import bcrypt from 'bcryptjs';
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
            client_id: admin.client_id || 'GLOBAL', // Default or legacy
            username: admin.username,
            password_hash: admin.password_hash,
            nom: admin.nom,
            prenom: admin.prenom,
            user_type: admin.user_type,
            role_code: admin.role_code || 'SUPER_ADMIN',
            role_id: admin.role_id,
            active: admin.active === 1
        };
    }

    public async authenticate(username: string, password: string): Promise<User | null> {
        const db = await getGlobalDB();
        // Check active status
        const admin = await get<any>(db, 'SELECT * FROM users WHERE username = ? AND active = 1', [username]);

        if (!admin) return null;

        const isValid = await bcrypt.compare(password, admin.password_hash);
        if (!isValid) return null;

        return this.mapUser(admin);
    }

    public async createGlobalAdmin(adminUser: User): Promise<User> {
        const db = await getGlobalDB();
        
        const existing = await get<any>(db, 'SELECT id FROM users WHERE username = ?', [adminUser.username]);
        if (existing) {
            throw new Error("Username already exists in Global Realm");
        }

        await run(db, `
            INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_code, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            adminUser.id, adminUser.username, adminUser.password_hash, adminUser.nom, adminUser.prenom, 
            adminUser.user_type, adminUser.role_code || 'SUPER_ADMIN', 1, new Date().toISOString()
        ]);

        return adminUser;
    }
    
    public async getAdminById(id: string): Promise<User | undefined> {
        const db = await getGlobalDB();
        const admin = await get<any>(db, 'SELECT * FROM users WHERE id = ?', [id]);
        if (!admin) return undefined;
        return this.mapUser(admin);
    }

    public async getGlobalRole(roleId: string): Promise<any> {
        const db = await getGlobalDB();
        const role = await get<any>(db, 'SELECT * FROM global_roles WHERE id = ?', [roleId]);
        if (!role) return undefined;
        return {
            id: role.id,
            code: role.code || 'USER', // default
            name: role.name,
            permissions: role.permissions ? JSON.parse(role.permissions) : [],
            modules: [] 
        };
    }

    public async getAllGlobalRoles(): Promise<any[]> {
        const db = await getGlobalDB();
        const rows = await all<any>(db, 'SELECT * FROM global_roles');
        return rows.map(role => ({
            id: role.id,
            code: role.code || 'USER',
            name: role.name,
            description: role.description,
            permissions: role.permissions ? JSON.parse(role.permissions) : [],
            modules: [] 
        }));
    }

    // Tenant Admin Management
    public async getTenantAdmin(clientId: string): Promise<User | undefined> {
        const db = await getGlobalDB();
        const row = await get<any>(db, 'SELECT * FROM users WHERE client_id = ? AND user_type = ?', [clientId, 'TENANT_SUPERADMIN']);
        if (!row) return undefined;
        return this.mapUser(row);
    }

    public async createTenantAdmin(admin: Partial<User>): Promise<User> {
         const db = await getGlobalDB();
         const now = new Date().toISOString();
         const newId = admin.id || `user_dsi_${Date.now()}`;
         
         await run(db, `
            INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_id, client_id, created_at, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         `, [
            newId,
            admin.username,
            admin.password_hash,
            admin.nom || 'Admin',
            admin.prenom || 'Structure',
            'TENANT_SUPERADMIN', // user_type
            admin.role_id || 'role_admin_struct', // role_id
            admin.client_id,
            now,
            1
         ]);
         
         return {
             ...admin,
             id: newId,
             user_type: 'TENANT_SUPERADMIN',
             role_code: 'ADMIN_STRUCT', 
             active: true
         } as User;
    }

    public async updateTenantAdmin(clientId: string, updates: Partial<User>): Promise<void> {
        const db = await getGlobalDB();
        const current = await this.getTenantAdmin(clientId);
        if (!current) {
            // If not found, create? No, update logic usually implies existence.
            // But superAdminController logic creates if not found. 
            // We'll let controller handle "if not found create".
            throw new Error("Tenant Admin not found");
        }

        // Dynamic update
        const fields: string[] = [];
        const values: any[] = [];
        
        if (updates.username) { fields.push('username=?'); values.push(updates.username); }
        if (updates.password_hash) { fields.push('password_hash=?'); values.push(updates.password_hash); }
        if (updates.nom) { fields.push('nom=?'); values.push(updates.nom); }
        if (updates.prenom) { fields.push('prenom=?'); values.push(updates.prenom); }
        
        if (fields.length > 0) {
            values.push(current.id);
            await run(db, `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        }
    }
    // --- Clients Management (SQL) ---
    public async getAllClients(): Promise<any[]> {
        const db = await getGlobalDB();
        return all<any>(db, 'SELECT * FROM clients ORDER BY created_at DESC');
    }

    public async getClientById(id: string): Promise<any> {
        const db = await getGlobalDB();
        return get<any>(db, 'SELECT * FROM clients WHERE id = ?', [id]);
    }

    public async createClient(client: any): Promise<any> {
        const db = await getGlobalDB();
        const now = new Date().toISOString();
        
        await run(db, `
            INSERT INTO clients (id, type, designation, siege_social, representant_legal, country, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            client.id, 
            client.type, 
            client.designation, 
            client.siege_social, 
            client.representant_legal, 
            client.country || 'MAROC', 
            now, now
        ]);
        return client;
    }

    public async updateClient(id: string, updates: any): Promise<any> {
        const db = await getGlobalDB();
        const fields: string[] = [];
        const values: any[] = [];
        
        if (updates.type) { fields.push('type=?'); values.push(updates.type); }
        if (updates.designation) { fields.push('designation=?'); values.push(updates.designation); }
        if (updates.siege_social) { fields.push('siege_social=?'); values.push(updates.siege_social); }
        if (updates.representant_legal) { fields.push('representant_legal=?'); values.push(updates.representant_legal); }
        if (updates.country) { fields.push('country=?'); values.push(updates.country); }
        
        fields.push("updated_at=?");
        values.push(new Date().toISOString());

        if (fields.length > 0) {
            values.push(id);
            await run(db, `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        return this.getClientById(id);
    }
    
    public async deleteClient(id: string): Promise<void> {
        const db = await getGlobalDB();
        await run(db, 'DELETE FROM clients WHERE id = ?', [id]);
        // Note: Should we delete or deactivate users?
        // Ideally we deactivate them.
        await run(db, 'UPDATE users SET active = 0 WHERE client_id = ?', [id]);
    }

    // --- Organismes Management (SQL) ---
    public async getAllOrganismes(): Promise<any[]> {
        const db = await getGlobalDB();
        return all<any>(db, 'SELECT * FROM organismes ORDER BY designation ASC');
    }

    public async createOrganisme(org: any): Promise<any> {
        const db = await getGlobalDB();
        const now = new Date().toISOString();
        
        await run(db, `
            INSERT INTO organismes (id, designation, category, sub_type, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            org.id, 
            org.designation, 
            org.category, 
            org.sub_type, 
            org.active !== undefined ? (org.active ? 1 : 0) : 1, 
            now, now
        ]);
        return org;
    }
}

export const globalAdminService = GlobalAdminService.getInstance();
