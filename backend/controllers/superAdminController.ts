
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { globalAdminService } from '../services/globalAdminService';
import { globalSupplierService } from '../services/globalSupplierService';
import { tenantProvisioningService } from '../services/tenantProvisioningService';
import { tenantUpdateService } from '../services/tenantUpdateService';
import { getTenantPool } from '../db/tenantPg';
import { syncTenantReference } from '../scripts/referenceSync';

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

// --- Tenants ---
export const getTenants = async (req: Request, res: Response) => {
    try {
        const tenants = await globalAdminService.getAllTenants();
        res.json(tenants);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
// Backwards-compat alias
export const getClients = getTenants;

export const getTenantDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenant = await globalAdminService.getTenantById(id);
        
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        
        // Find associated DSI (Tenant Super Admin) from Global DB
        const dsi = await globalAdminService.getTenantAdmin(id);
        
        // Return combined data
        res.json({
            ...tenant,
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
export const getClientDetails = getTenantDetails;

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
                tenantId: id,
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

export const createTenant = async (req: Request, res: Response) => {
    try {
        // Validate DSI Info first
        if (!req.body.admin_username || !req.body.admin_password) {
            return res.status(400).json({ error: 'Les informations du compte DSI (Login/Mot de passe) sont obligatoires.' });
        }

        const tenantId = uuidv4();
        
        // 1. Create Tenant in Global SQL DB
        const newTenant = await globalAdminService.createTenant({ 
            id: tenantId, 
            type: req.body.type,
            designation: req.body.designation,
            siege_social: req.body.siege_social,
            representant_legal: req.body.representant_legal,
            country: req.body.country || 'MAROC',
            tenancy_mode: req.body.tenancy_mode || 'STANDALONE',
            group_id: req.body.group_id || null
        });
        
        // NOTE: DSI user is created ONLY in tenant.auth.users (step 3 below)
        // sahty_global.users is reserved for platform superadmins only

        // 2.5. PROVISION TENANT DATABASE
        try {
            console.log(`[createTenant] Provisioning tenant DB for ${tenantId}...`);
            await tenantProvisioningService.createTenantDatabase(tenantId);
            console.log(`[createTenant] Tenant DB provisioned.`);
        } catch (dbErr: any) {
            console.error("[createTenant] Failed to provision tenant DB:", dbErr);
            throw new Error(`Failed to provision tenant database: ${dbErr.message}`);
        }

        // 3. INITIALIZE TENANT REALM - Sync admin user to Tenant PostgreSQL DB
        try {
            // Look up ADMIN_STRUCTURE role from reference.global_roles (seeded by referenceSync)
            const { tenantQuery } = require('../db/tenantPg');
            const adminStructRows = await tenantQuery(tenantId, 
                "SELECT id FROM reference.global_roles WHERE code = 'ADMIN_STRUCTURE' LIMIT 1", []);
            const roleAdminStructId = adminStructRows.length > 0 
                ? adminStructRows[0].id 
                : null;

            if (!roleAdminStructId) {
                console.warn('[createTenant] ADMIN_STRUCTURE role not found in reference.global_roles');
            }

            const tenantUserId = uuidv4();
            const tenantUser = {
                id: tenantUserId, 
                client_id: tenantId,
                username: req.body.admin_username,
                password_hash: bcrypt.hashSync(req.body.admin_password, 10),
                nom: req.body.admin_nom || 'Directeur',
                prenom: req.body.admin_prenom || 'Admin',
                user_type: 'TENANT_SUPERADMIN',
                role_id: roleAdminStructId,
                active: true,
                service_ids: []
            };

            // Roles are already in reference.global_roles (seeded by referenceSync during provisioning)
            // Only need to sync the admin user to tenant DB for Settings Module visibility
            const { settingsService } = require('../services/settingsService');
            await settingsService.createUser(tenantId, tenantUser);
            console.log(`[createTenant] Synced Admin ${tenantUser.username} to Tenant SQL ${tenantId}`);
        } catch (sqlErr: any) {
            console.error(`[createTenant] Failed to sync Tenant SQL: ${sqlErr.message}`);
            // Don't fail the request, but log critical error
        }

        res.json(newTenant);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
export const createClient = createTenant;

export const updateTenant = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updated = await globalAdminService.updateTenant(id, req.body);
        if (updated) {
            res.json(updated);
        } else {
            res.status(404).json({ error: 'Tenant not found' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
export const updateClient = updateTenant;

export const deleteTenant = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await globalAdminService.deleteTenant(id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
export const deleteClient = deleteTenant;

// --- Reference Schema Updates ---
export const updateTenantReferenceSchema = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result: any = await tenantUpdateService.updateTenantReferenceSchema(id);
        
        // After schema is updated, ensure the DATA is synced from global to tenant
        try {
            const pool = getTenantPool(id);
            const client = await pool.connect();
            try {
                await syncTenantReference(client, id);
                result.dataSyncStatus = 'success';
            } finally {
                client.release();
            }
        } catch (syncErr: any) {
            console.error(`[updateTenantReferenceSchema] Sync data failed for ${id}:`, syncErr);
            result.dataSyncStatus = 'error';
            result.dataSyncError = syncErr.message;
        }

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateAllReferenceSchemas = async (req: Request, res: Response) => {
    try {
        const tenants = await globalAdminService.getAllTenants();
        const results = [];
        
        for (const tenant of tenants) {
            try {
                const result: any = await tenantUpdateService.updateTenantReferenceSchema(tenant.id);
                
                // After schema is updated, ensure the DATA is synced
                try {
                    const pool = getTenantPool(tenant.id);
                    const client = await pool.connect();
                    try {
                        await syncTenantReference(client, tenant.id);
                        result.dataSyncStatus = 'success';
                    } finally {
                        client.release();
                    }
                } catch (syncErr: any) {
                    console.error(`[updateAllReferenceSchemas] Sync data failed for ${tenant.id}:`, syncErr);
                    result.dataSyncStatus = 'error';
                    result.dataSyncError = syncErr.message;
                }

                results.push({ tenantId: tenant.id, designation: tenant.designation, ...result });
            } catch (tenantErr: any) {
                results.push({ tenantId: tenant.id, designation: tenant.designation, status: 'error', error: tenantErr.message });
            }
        }
        res.json({ status: 'success', summary: results });
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

// --- Groups ---
import { groupService } from '../services/groupService';

export const getGroups = async (req: Request, res: Response) => {
    try {
        const groups = await groupService.listGroups();
        res.json(groups);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const getGroup = async (req: Request, res: Response) => {
    try {
        const group = await groupService.getGroupById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json(group);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const group = await groupService.createGroup(req.body);
        res.json(group);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const group = await groupService.updateGroup(req.params.id, req.body);
        res.json(group);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    try {
        await groupService.deleteGroup(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
