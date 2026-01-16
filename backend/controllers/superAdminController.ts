
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(__dirname, '../data');

// Helpers to read JSON files
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
export const getClients = (req: Request, res: Response) => {
    const clients = readJson('clients.json');
    res.json(clients);
};

export const getClientDetails = (req: Request, res: Response) => {
    const { id } = req.params;
    const clients = readJson('clients.json');
    const client = clients.find((c: any) => c.id === id);
    
    if (!client) {
        return res.status(404).json({ error: 'Client not found' });
    }
    
    // Find associated DSI (Tenant Super Admin)
    const users = readJson('users.json');
    const dsi = users.find((u: any) => u.client_id === id && u.user_type === 'TENANT_SUPERADMIN');
    
    // Return combined data
    res.json({
        ...client,
        dsi: dsi ? {
            username: dsi.username,
            nom: dsi.nom,
            prenom: dsi.prenom
        } : null
    });
};

export const updateClientDSI = (req: Request, res: Response) => {
    const { id } = req.params; // Client ID
    const { username, password } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const users = readJson('users.json');
    const dsiIndex = users.findIndex((u: any) => u.client_id === id && u.user_type === 'TENANT_SUPERADMIN');
    
    if (dsiIndex === -1) {
        // Create new DSI user if not found
        if (!password) {
             return res.status(400).json({ error: 'Password is required to create a new DSI account' });
        }
        
        const newDSI = {
            id: `user_dsi_${Date.now()}`,
            username: username,
            password_hash: bcrypt.hashSync(password, 10),
            nom: "Admin", // Defaults, can be updated later if we add fields
            prenom: "DSI", 
            user_type: 'TENANT_SUPERADMIN',
            role_id: 'role_admin_struct',
            client_id: id
        };
        users.push(newDSI);
    } else {
        // Update existing
        users[dsiIndex].username = username;
        if (password && password.trim() !== '') {
            users[dsiIndex].password_hash = bcrypt.hashSync(password, 10);
        }
    }
    
    writeJson('users.json', users);
    
    res.json({ success: true, message: 'Compte DSI mis à jour' });
};

export const createClient = (req: Request, res: Response) => {
    // Validate DSI Info first
    if (!req.body.admin_username || !req.body.admin_password) {
        return res.status(400).json({ error: 'Les informations du compte DSI (Login/Mot de passe) sont obligatoires.' });
    }

    const clients = readJson('clients.json');
    const users = readJson('users.json');
    
    // Use a simpler timestamp for ID to avoid filesystem issues with long names if any
    const clientId = `client_${Date.now()}`;
    
    // 1. Create Client in SuperAdmin Registry
    const newClient = { 
        id: clientId, 
        type: req.body.type,
        designation: req.body.designation,
        siege_social: req.body.siege_social,
        representant_legal: req.body.representant_legal
    };
    clients.push(newClient);
    
    // 2. Create DSI User in SuperAdmin Registry (Legacy/View purposes)
    const newDSI_Global = {
        id: `user_dsi_${Date.now()}`,
        username: req.body.admin_username,
        password_hash: bcrypt.hashSync(req.body.admin_password, 10),
        nom: req.body.admin_nom || 'Directeur',
        prenom: req.body.admin_prenom || 'Admin',
        user_type: 'TENANT_SUPERADMIN',
        role_id: 'role_admin_struct', 
        client_id: clientId
    };
    users.push(newDSI_Global);
    
    writeJson('clients.json', clients);
    writeJson('users.json', users);

    // 3. INITIALIZE TENANT REALM (CRITICAL FOR LOGIN)
    // We must create tenants/<clientId>/settings.json and seed the admin user there
    try {
        const { TenantStore } = require('../utils/tenantStore'); // Lazy import to avoid circular dep issues in some envs
        const store = new TenantStore(clientId);
        
        // Define default roles for the new tenant
        // Copying from SEED_ROLES logic or consistent default
        const defaultRoles = [
          {
            "id": "role_super_admin",
            "name": "Super Admin Global",
            "code": "SUPER_ADMIN",
            "permissions": ["sa_clients", "sa_organismes", "sa_roles", "sa_actes"]
          },
          {
            "id": "role_admin_struct",
            "name": "Administrateur Structure",
            "code": "ADMIN_STRUCTURE",
            "permissions": ["st_users", "st_services", "st_rooms", "st_pricing", "st_roles"],
            "modules": ["SETTINGS", "PHARMACY", "EMR"] // Give DSI access to all modules
          },
          // Add other default roles if needed, or keep it minimal for now
        ];

        // Create the actual tenant user for authentication
        const tenantUser = {
            id: newDSI_Global.id,
            client_id: clientId,
            username: newDSI_Global.username,
            password_hash: newDSI_Global.password_hash,
            nom: newDSI_Global.nom,
            prenom: newDSI_Global.prenom,
            user_type: 'TENANT_SUPERADMIN', // CORRECTED: Must match App.tsx ProtectedRoute
            role_id: 'role_admin_struct',
            active: true
        };

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
        
        // Initialize other modules empty
        store.save('pharmacy', { inventory: [], catalog: [], locations: [], partners: [], stockOutHistory: [], replenishmentRequests: [] });
        store.save('emr_admissions', { admissions: [], appointments: [], consumptions: [] });
        
    } catch (e: any) {
        console.error("Failed to initialize tenant realm:", e);
        // Should we rollback? For now just log.
    }
    
    res.json(newClient);
};

export const updateClient = (req: Request, res: Response) => {
    const { id } = req.params;
    let clients = readJson('clients.json');
    const index = clients.findIndex((c: any) => c.id === id);
    if (index !== -1) {
        // Only update allowed fields
        const { type, designation, siege_social, representant_legal } = req.body;
        clients[index] = { 
            ...clients[index], 
            type, designation, siege_social, representant_legal 
        };
        writeJson('clients.json', clients);
        res.json(clients[index]);
    } else {
        res.status(404).json({ error: 'Client not found' });
    }
};

export const deleteClient = (req: Request, res: Response) => {
    const { id } = req.params;
    let clients = readJson('clients.json');
    clients = clients.filter((c: any) => c.id !== id);
    
    // Should we also delete the user? Yes, for consistency.
    let users = readJson('users.json');
    users = users.filter((u: any) => u.client_id !== id);
    
    writeJson('clients.json', clients);
    writeJson('users.json', users);
    
    res.json({ success: true });
};

// --- Organismes ---
export const getOrganismes = (req: Request, res: Response) => {
    const organismes = readJson('organismes.json');
    res.json(organismes);
};

export const createOrganisme = (req: Request, res: Response) => {
    const organismes = readJson('organismes.json');
    const newOrganisme = { id: `org_${Date.now()}`, ...req.body };
    organismes.push(newOrganisme);
    writeJson('organismes.json', organismes);
    res.json(newOrganisme);
};

// --- Roles ---
export const getRoles = (req: Request, res: Response) => {
    // Read from global/roles.json
    const filePath = path.join(DATA_DIR, 'global', 'roles.json');
    if (!fs.existsSync(filePath)) return res.json([]);
    const roles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(roles);
};

export const getRole = (req: Request, res: Response) => {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, 'global', 'roles.json');
    const roles = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
    const role = roles.find((r: any) => r.id === id);
    if (!role) {
        return res.status(404).json({ error: 'Role not found' });
    }
    res.json(role);
};

export const createRole = (req: Request, res: Response) => {
    const filePath = path.join(DATA_DIR, 'global', 'roles.json');
    const roles = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
    }

    const newRole = {
        id: `role_${Date.now()}`,
        name,
        description: description || '',
        permissions: [] // Start with empty permissions
    };

    roles.push(newRole);

    // writeJson('roles.json', roles); // Old
    fs.writeFileSync(filePath, JSON.stringify(roles, null, 2));
    res.json(newRole);
};

export const updateRole = (req: Request, res: Response) => {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, 'global', 'roles.json');
    let roles = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
    const index = roles.findIndex((r: any) => r.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Role not found' });
    }

    const { name, description, permissions } = req.body;

    roles[index] = {
        ...roles[index],
        name: name || roles[index].name,
        description: description !== undefined ? description : roles[index].description,
        permissions: permissions || roles[index].permissions || []
    };
    
    fs.writeFileSync(filePath, JSON.stringify(roles, null, 2));
    res.json(roles[index]);
};

// --- Global Suppliers ---
export const getGlobalSuppliers = (req: Request, res: Response) => {
    let suppliers = readJson('global_suppliers.json');
    // Filter out deleted
    suppliers = suppliers.filter((s: any) => !s.deleted_at);
    res.json(suppliers);
};

export const createGlobalSupplier = (req: Request, res: Response) => {
    const suppliers = readJson('global_suppliers.json');
    const { name, is_active } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Check uniqueness (case insensitive) among non-deleted
    const exists = suppliers.find((s: any) => 
        !s.deleted_at && s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
        return res.status(400).json({ error: 'Un fournisseur avec ce nom existe déjà.' });
    }

    const newSupplier = {
        id: `supp_${Date.now()}`,
        name,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
    };

    suppliers.push(newSupplier);
    writeJson('global_suppliers.json', suppliers);
    res.json(newSupplier);
};

export const updateGlobalSupplier = (req: Request, res: Response) => {
    const { id } = req.params;
    let suppliers = readJson('global_suppliers.json');
    const index = suppliers.findIndex((s: any) => s.id === id);

    if (index === -1 || suppliers[index].deleted_at) {
        return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, is_active } = req.body;

    // Check uniqueness if name changes
    if (name && name.toLowerCase() !== suppliers[index].name.toLowerCase()) {
        const exists = suppliers.find((s: any) => 
             s.id !== id && !s.deleted_at && s.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
            return res.status(400).json({ error: 'Un fournisseur avec ce nom existe déjà.' });
        }
    }

    suppliers[index] = {
        ...suppliers[index],
        name: name || suppliers[index].name,
        is_active: is_active !== undefined ? is_active : suppliers[index].is_active,
        updated_at: new Date().toISOString()
    };

    writeJson('global_suppliers.json', suppliers);
    res.json(suppliers[index]);
};

export const deleteGlobalSupplier = (req: Request, res: Response) => {
    const { id } = req.params;
    let suppliers = readJson('global_suppliers.json');
    const index = suppliers.findIndex((s: any) => s.id === id);

    if (index === -1) {
        return res.status(404).json({ error: 'Supplier not found' });
    }

    // Soft delete
    suppliers[index].deleted_at = new Date().toISOString();
    
    writeJson('global_suppliers.json', suppliers);
    res.json({ success: true });
};
