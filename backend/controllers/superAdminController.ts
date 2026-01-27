
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { globalAdminService } from '../services/globalAdminService';
import { globalSupplierService } from '../services/globalSupplierService';
import { tenantProvisioningService } from '../services/tenantProvisioningService';

// Legacy: Clients store? 'clients.json' might still be used if we didn't migrate clients to SQL.
// Did we migrate Clients? NO. Only Global Data (Products, DCI, Suppliers, Roles, Acts).
// Clients/Tenants are still in clients.json?
// Checking migration script: No client migration.
// So we KEEP interacting with clients.json.
// But Users (Tenant Admins) ARE in Global DB.

const DATA_DIR = path.join(__dirname, '../data');

// Helpers to read JSON files (Legacy)
const readJson = (filename: string) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writeJson = (filename: string, data: any) => {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// --- Clients (Tenants) ---
export const getClients = async (req: Request, res: Response) => {
    try {
        const clients = await globalAdminService.getAllClients();
        res.json(clients);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
    // Legacy: const clients = readJson('clients.json');
};

export const getClientDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const client = await globalAdminService.getClientById(id);
        
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        // Find associated DSI (Tenant Super Admin) from Global DB
        const dsi = await globalAdminService.getTenantAdmin(id);
        
        // Return combined data
        res.json({
            ...client,
            dsi: dsi ? {
                username: dsi.username,
                nom: dsi.nom,
                prenom: dsi.prenom
            } : null
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateClientDSI = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Client ID
        const { username, password } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if DSI exists
        const dsi = await globalAdminService.getTenantAdmin(id);
        
        if (!dsi) {
            // Create new DSI user
            if (!password) {
                return res.status(400).json({ error: 'Password is required to create a new DSI account' });
            }
            
            await globalAdminService.createTenantAdmin({
                username,
                password_hash: bcrypt.hashSync(password, 10),
                client_id: id,
                nom: "Admin",
                prenom: "DSI"
            });
        } else {
            // Update existing
            const updates: any = { username };
            if (password && password.trim() !== '') {
                updates.password_hash = bcrypt.hashSync(password, 10);
            }
            await globalAdminService.updateTenantAdmin(id, updates);
        }
        
        res.json({ success: true, message: 'Compte DSI mis à jour' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

import { v4 as uuidv4 } from 'uuid';

export const createClient = async (req: Request, res: Response) => {
    try {
        // Validate DSI Info first
        if (!req.body.admin_username || !req.body.admin_password) {
            return res.status(400).json({ error: 'Les informations du compte DSI (Login/Mot de passe) sont obligatoires.' });
        }

        const clientId = uuidv4();
        
        // 1. Create Client in Global SQL DB
        const newClient = await globalAdminService.createClient({ 
            id: clientId, 
            type: req.body.type,
            designation: req.body.designation,
            siege_social: req.body.siege_social,
            representant_legal: req.body.representant_legal,
            country: req.body.country || 'MAROC'
        });
        
        // 2. Create DSI User in Global DB
        await globalAdminService.createTenantAdmin({
            username: req.body.admin_username,
            password_hash: bcrypt.hashSync(req.body.admin_password, 10),
            nom: req.body.admin_nom || 'Directeur',
            prenom: req.body.admin_prenom || 'Admin',
            client_id: clientId,
            role_id: 'role_admin_struct'
        });

        // 2.5. PROVISION TENANT DATABASE
        try {
            console.log(`[createClient] Provisioning tenant DB for ${clientId}...`);
            await tenantProvisioningService.createTenantDatabase(clientId);
            console.log(`[createClient] Tenant DB provisioned.`);
        } catch (dbErr: any) {
            console.error("[createClient] Failed to provision tenant DB:", dbErr);
            throw new Error(`Failed to provision tenant database: ${dbErr.message}`);
        }

        // 3. INITIALIZE TENANT REALM (CRITICAL FOR LOGIN)
        try {
            const { TenantStore } = require('../utils/tenantStore');
            const store = new TenantStore(clientId);
            
            // Define default roles for the new tenant with valid UUIDs
            const roleSuperAdminId = uuidv4();
            const roleAdminStructId = uuidv4();

            const defaultRoles = [
              {
                "id": roleSuperAdminId,
                "name": "Super Admin Global",
                "code": "SUPER_ADMIN",
                "permissions": ["sa_clients", "sa_organismes", "sa_roles", "sa_actes"]
              },
              {
                "id": roleAdminStructId,
                "name": "Administrateur Structure",
                "code": "ADMIN_STRUCTURE",
                "permissions": ["st_users", "st_services", "st_rooms", "st_pricing", "st_roles"],
                "modules": ["SETTINGS", "PHARMACY", "EMR"] 
              }
            ];

            // Create valid tenant user for internal checks? 
            // Note: Login now checks Global DB. But SettingsService reads Tenant DB.
            // If we don't put user in Tenant DB, Settings won't list them in "Manage Users".
            // So we MUST sync DSI to Tenant DB too for visibility.
            
            const tenantUserId = uuidv4(); // Generate valid UUID for tenant user
            const tenantUser = {
                id: tenantUserId, 
                client_id: clientId,
                username: req.body.admin_username,
                password_hash: bcrypt.hashSync(req.body.admin_password, 10),
                nom: req.body.admin_nom || 'Directeur',
                prenom: req.body.admin_prenom || 'Admin',
                user_type: 'TENANT_SUPERADMIN',
                role_id: roleAdminStructId, // Use the valid UUID generated above
                active: true,
                service_ids: []
            };

            // 4. SYNC TO TENANT SQL DB (Required for Settings Module)
            try {
                const { settingsService } = require('../services/settingsService');
                
                // Seed Roles First (FK for User)
                for (const role of defaultRoles) {
                    await settingsService.createRole(clientId, role);
                }
                console.log(`[CreateClient] Synced ${defaultRoles.length} Roles to Tenant SQL ${clientId}`);

                // Seed Admin User
                await settingsService.createUser(clientId, tenantUser);
                console.log(`[CreateClient] Synced Admin ${tenantUser.username} to Tenant SQL ${clientId}`);
            } catch (sqlErr: any) {
                console.error(`[CreateClient] Failed to sync Tenant SQL: ${sqlErr.message}`);
                // Don't fail the request, but log critical error
            }

            // Legacy JSON fallback (for safety)
            const settings = {
                users: [tenantUser],
                roles: defaultRoles,
                services: [],
                unitTypes: [],
                serviceUnits: [],
                pricing: [],
                rooms: []
            };

            store.save('settings', settings);
            store.save('pharmacy', { inventory: [], catalog: [], locations: [], partners: [], stockOutHistory: [], replenishmentRequests: [] });
            store.save('emr_admissions', { admissions: [], appointments: [], consumptions: [] });
            
        } catch (e: any) {
            console.error("Failed to initialize tenant realm:", e);
        }
        
        res.json(newClient);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updated = await globalAdminService.updateClient(id, req.body);
        if (updated) {
            res.json(updated);
        } else {
            res.status(404).json({ error: 'Client not found' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await globalAdminService.deleteClient(id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

// --- Organismes (SQL) ---
export const getOrganismes = async (req: Request, res: Response) => {
    try {
        const organismes = await globalAdminService.getAllOrganismes();
        res.json(organismes);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createOrganisme = async (req: Request, res: Response) => {
    try {
        const newOrganisme = await globalAdminService.createOrganisme({ 
            id: uuidv4(), 
            ...req.body 
        });
        res.json(newOrganisme);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

// --- Global Roles (SQL) ---
export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await globalAdminService.getAllGlobalRoles();
        res.json(roles);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

// getRole (Single) - Not commonly used by frontend, but nice to have
export const getRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const role = await globalAdminService.getGlobalRole(id);
        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.json(role);
    } catch (e: any) {
         res.status(500).json({ error: e.message });
    }
};

// Create Role - SuperAdmin only
export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, description, permissions } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Le nom du rôle est obligatoire.' });
        }
        
        const newRole = await globalAdminService.createGlobalRole({ name, description, permissions });
        res.status(201).json(newRole);
    } catch (e: any) {
        console.error('[createRole] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
};
export const updateRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await globalAdminService.updateGlobalRole(id, req.body);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};


// --- Global Suppliers (SQL) ---
export const getGlobalSuppliers = async (req: Request, res: Response) => {
    try {
        const suppliers = await globalSupplierService.getAll();
        res.json(suppliers);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createGlobalSupplier = async (req: Request, res: Response) => {
    try {
        const supplier = await globalSupplierService.create(req.body);
        res.json(supplier);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const updateGlobalSupplier = async (req: Request, res: Response) => {
    try {
        const supplier = await globalSupplierService.update(req.params.id, req.body);
        res.json(supplier);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const deleteGlobalSupplier = async (req: Request, res: Response) => {
    try {
        await globalSupplierService.delete(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
