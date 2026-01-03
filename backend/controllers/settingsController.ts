
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { User, UserType } from '../models/auth';

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const SERVICE_UNITS_FILE = path.join(DATA_DIR, 'service_units.json');
const PRICING_FILE = path.join(DATA_DIR, 'pricing.json');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');

const readJson = (file: string) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
};
const writeJson = (file: string, data: any) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Helper to filter by client
const filterByClient = (data: any[], clientId: string) => data.filter(item => item.client_id === clientId);

// --- Users ---
export const getMyUsers = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const users = readJson(USERS_FILE);
    res.json(filterByClient(users, req.user.client_id).map((u: User) => ({ ...u, password_hash: undefined })));
};

export const createMyUser = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { username, password, nom, prenom, role_id, INPE, pièce_identité } = req.body;
    
    const users = readJson(USERS_FILE);
    if (users.find((u: User) => u.username === username)) {
        return res.status(400).json({ error: 'Username taken' });
    }

    const newUser: User = {
        id: `user_${Date.now()}`,
        client_id: req.user.client_id,
        username,
        password_hash: bcrypt.hashSync(password, 10),
        nom,
        prenom,
        user_type: UserType.TENANT_USER, // or derive based on role? Simplified to TENANT_USER
        role_id,
        INPE,
        service_ids: req.body.service_ids || [] // Initialize service_ids
        // pièce_identité optional
    };
    
    // Validate Services if provided
    if (newUser.service_ids && newUser.service_ids.length > 0) {
        const services = readJson(SERVICES_FILE);
        const validServices = services.filter((s: any) => s.client_id === req.user!.client_id).map((s: any) => s.id);
        const allValid = newUser.service_ids.every((sid: string) => validServices.includes(sid));
        
        if (!allValid) {
            return res.status(400).json({ error: 'Un ou plusieurs services sélectionnés sont invalides.' });
        }
    }
    
    users.push(newUser);
    writeJson(USERS_FILE, users);
    const { password_hash, ...safeUser } = newUser;
    res.json(safeUser);
};

export const updateTenantUser = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id } = req.params;
    const { nom, prenom, username, password, role_id, INPE, active, service_ids } = req.body;

    let users = readJson(USERS_FILE);
    const index = users.findIndex((u: User) => u.id === id && u.client_id === req.user!.client_id);

    if (index === -1) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const currentUser = users[index];

    // PROTECTION: Prevent modifying the Tenant Super Admin (DSI)
    if (currentUser.role_id === 'role_admin_struct') {
        return res.status(403).json({ error: 'Modification interdite pour l\'administrateur principal.' });
    }

    // Check for duplicate username (if changed)
    if (username && username !== currentUser.username) {
        const exists = users.some((u: User) => u.username === username && u.id !== id);
        if (exists) return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
    }

    // Validate Services if provided
    if (service_ids && Array.isArray(service_ids)) {
        const services = readJson(SERVICES_FILE);
        const validServices = services.filter((s: any) => s.client_id === req.user!.client_id).map((s: any) => s.id);
        const allValid = service_ids.every((sid: string) => validServices.includes(sid));
        
        if (!allValid) {
            return res.status(400).json({ error: 'Un ou plusieurs services sélectionnés sont invalides.' });
        }
    }

    // Handle Password Update
    let newPasswordHash = currentUser.password_hash;
    if (password && password.trim() !== '') {
        newPasswordHash = bcrypt.hashSync(password, 10);
    }

    // Update fields
    users[index] = {
        ...currentUser,
        nom: nom || currentUser.nom,
        prenom: prenom || currentUser.prenom,
        username: username || currentUser.username,
        role_id: role_id || currentUser.role_id,
        INPE: INPE !== undefined ? INPE : currentUser.INPE,
        password_hash: newPasswordHash,
        active: active !== undefined ? active : (currentUser.active !== undefined ? currentUser.active : true),
        service_ids: service_ids !== undefined ? service_ids : currentUser.service_ids
    };

    writeJson(USERS_FILE, users);
    
    const { password_hash: _, ...safeUser } = users[index];
    res.json(safeUser);
};

// --- Roles (Read Only) ---
export const getGlobalRoles = (req: Request, res: Response) => {
    res.json(readJson(ROLES_FILE));
};

// --- Services ---
export const getServices = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(SERVICES_FILE);
    res.json(filterByClient(list, req.user.client_id));
};

export const getService = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(SERVICES_FILE);
    const service = list.find((s: any) => s.id === req.params.id && s.client_id === req.user!.client_id);
    
    if (!service) {
        return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
};

export const createService = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(SERVICES_FILE);
    
    // Validate Mandatory Fields
    if (!req.body.name || !req.body.code) {
        return res.status(400).json({ error: 'Le nom et le code du service sont obligatoires.' });
    }

    // Check for Duplicate Name within Client
    const nameExists = list.some((s: any) => s.client_id === req.user!.client_id && s.name.toLowerCase() === req.body.name.toLowerCase());
    if (nameExists) {
        return res.status(400).json({ error: 'Le nom choisi est déjà attribué à un autre service pré-existant.' });
    }

    // Check for Duplicate Code within Client
    const codeExists = list.some((s: any) => s.client_id === req.user!.client_id && s.code.toLowerCase() === req.body.code.toLowerCase());
    if (codeExists) {
        return res.status(400).json({ error: 'Ce code service est déjà utilisé.' });
    }

    const newItem = { id: `svc_${Date.now()}`, client_id: req.user.client_id, ...req.body };
    list.push(newItem);
    writeJson(SERVICES_FILE, list);
    res.json(newItem);
};

export const updateService = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id } = req.params;
    let list = readJson(SERVICES_FILE);
    const index = list.findIndex((s: any) => s.id === id && s.client_id === req.user!.client_id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Service not found or unauthorized' });
    }

    // Check for Duplicate Name excluding current
    if (req.body.name) {
         const exists = list.some((s: any) => s.client_id === req.user!.client_id && s.id !== id && s.name.toLowerCase() === req.body.name.toLowerCase());
         if (exists) return res.status(400).json({ error: 'Le nom choisi est déjà attribué à un autre service pré-existant.' });
    }
    
    // Check for Duplicate Code excluding current
    if (req.body.code) {
         const exists = list.some((s: any) => s.client_id === req.user!.client_id && s.id !== id && s.code.toLowerCase() === req.body.code.toLowerCase());
         if (exists) return res.status(400).json({ error: 'Ce code service est déjà utilisé.' });
    }

    list[index] = { ...list[index], ...req.body };
    writeJson(SERVICES_FILE, list);
    res.json(list[index]);
};

export const deleteService = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id } = req.params;
    let list = readJson(SERVICES_FILE);
    const filtered = list.filter((s: any) => !(s.id === id && s.client_id === req.user!.client_id));
    
    if (filtered.length === list.length) {
         return res.status(404).json({ error: 'Service not found or unauthorized' });
    }
    
    writeJson(SERVICES_FILE, filtered);
    res.json({ success: true });
};

// --- Rooms ---
export const getRooms = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(ROOMS_FILE);
    res.json(filterByClient(list, req.user.client_id));
};

export const createRoom = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(ROOMS_FILE);
    
    // Valid Categories
    const VALID_CATEGORIES = ['CHAMBRE', 'PLATEAU_TECHNIQUE', 'BOOTH_CONSULTATION'];
    if (!VALID_CATEGORIES.includes(req.body.unit_category)) {
        return res.status(400).json({ error: 'Catégorie d\'unité invalide.' });
    }

    // Name is mandatory
    if (!req.body.name) {
        return res.status(400).json({ error: 'Le nom de l\'unité est obligatoire.' });
    }

    // Check for Duplicate Name within Client
    const exists = list.some((r: any) => r.client_id === req.user!.client_id && r.name.toLowerCase() === req.body.name.toLowerCase());
    if (exists) {
        return res.status(400).json({ error: 'Une unité avec ce nom existe déjà.' });
    }

    // Validation for CHAMBRE
    let numberOfBeds = null;
    if (req.body.unit_category === 'CHAMBRE') {
        if (!req.body.number_of_beds) {
            return res.status(400).json({ error: 'Le nombre de lits est obligatoire pour une chambre.' });
        }
        const beds = parseInt(req.body.number_of_beds);
        if (isNaN(beds) || beds < 1 || beds > 6) {
            return res.status(400).json({ error: 'Le nombre de lits doit être compris entre 1 et 6.' });
        }
        numberOfBeds = beds;
    }

    const newItem = { 
        id: `room_${Date.now()}`, 
        client_id: req.user.client_id, 
        name: req.body.name,
        description: req.body.description,
        unit_category: req.body.unit_category,
        number_of_beds: numberOfBeds
    };

    list.push(newItem);
    writeJson(ROOMS_FILE, list);
    res.json(newItem);
};

export const updateRoom = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id } = req.params;
    let list = readJson(ROOMS_FILE);
    const index = list.findIndex((r: any) => r.id === id && r.client_id === req.user!.client_id);
    
    if (index === -1) {
        return res.status(404).json({ error: 'Unité non trouvée.' });
    }

    // Duplicate Name Check excluding current
    if (req.body.name) {
         const exists = list.some((r: any) => r.client_id === req.user!.client_id && r.id !== id && r.name.toLowerCase() === req.body.name.toLowerCase());
         if (exists) return res.status(400).json({ error: 'Une unité avec ce nom existe déjà.' });
    }

    // Logic for updating specific fields
    const currentItem = list[index];
    const category = req.body.unit_category || currentItem.unit_category; // Category usually shouldn't change, but if allowed...
    
    let numberOfBeds = currentItem.number_of_beds;

    if (category === 'CHAMBRE') {
        if (req.body.number_of_beds !== undefined) {
             const beds = parseInt(req.body.number_of_beds);
             if (isNaN(beds) || beds < 1 || beds > 6) {
                return res.status(400).json({ error: 'Le nombre de lits doit être compris entre 1 et 6.' });
             }
             numberOfBeds = beds;
        }
    } else {
        numberOfBeds = null;
    }

    list[index] = { 
        ...currentItem, 
        name: req.body.name || currentItem.name,
        description: req.body.description !== undefined ? req.body.description : currentItem.description,
        unit_category: category,
        number_of_beds: numberOfBeds
    };

    writeJson(ROOMS_FILE, list);
    res.json(list[index]);
};

export const deleteRoom = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id } = req.params;
    let list = readJson(ROOMS_FILE);
    const filtered = list.filter((r: any) => !(r.id === id && r.client_id === req.user!.client_id));
    
    if (filtered.length === list.length) {
         return res.status(404).json({ error: 'Unité non trouvée.' });
    }
    
    writeJson(ROOMS_FILE, filtered);
    res.json({ success: true });
};

// --- Pricing ---
export const getPricing = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(PRICING_FILE);
    res.json(filterByClient(list, req.user.client_id));
};

export const createPricing = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const list = readJson(PRICING_FILE);
    const newItem = { id: `prc_${Date.now()}`, client_id: req.user.client_id, ...req.body };
    list.push(newItem);
    writeJson(PRICING_FILE, list);
    res.json(newItem);
};

// --- Service Units (Plan de Service) ---

export const getServiceUnits = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id: serviceId } = req.params;
    const list = readJson(SERVICE_UNITS_FILE);
    
    // Filter by client AND service
    const units = list.filter((u: any) => u.client_id === req.user!.client_id && u.service_id === serviceId);
    res.json(units);
};

export const createServiceUnit = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { id: serviceId } = req.params;
    const { unit_type_id, name } = req.body;

    if (!name || !unit_type_id) {
        return res.status(400).json({ error: 'Nom et Type d\'unité obligatoires.' });
    }

    // Verify Service belongs to client
    const services = readJson(SERVICES_FILE);
    const service = services.find((s: any) => s.id === serviceId && s.client_id === req.user!.client_id);
    if (!service) return res.status(404).json({ error: 'Service invalid.' });

    // Verify Unit Type (Room Definition) belongs to client
    const rooms = readJson(ROOMS_FILE);
    const roomType = rooms.find((r: any) => r.id === unit_type_id && r.client_id === req.user!.client_id);
    if (!roomType) return res.status(404).json({ error: 'Type d\'unité invalid.' });

    const list = readJson(SERVICE_UNITS_FILE);
    
    // Check for duplicate name IN THIS SERVICE
    const exists = list.some((u: any) => 
        u.client_id === req.user!.client_id && 
        u.service_id === serviceId && 
        u.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
        return res.status(400).json({ error: 'Une unité avec ce nom existe déjà dans ce service.' });
    }

    const newUnit = {
        id: `unit_inst_${Date.now()}`,
        client_id: req.user.client_id,
        service_id: serviceId,
        unit_type_id,
        name,
        created_at: new Date().toISOString()
    };

    list.push(newUnit);
    writeJson(SERVICE_UNITS_FILE, list);
    res.json(newUnit);
};

export const deleteServiceUnit = (req: AuthRequest, res: Response) => {
    if (!req.user?.client_id) return res.status(403).json({ error: 'No client context' });
    const { unitId } = req.params;

    let list = readJson(SERVICE_UNITS_FILE);
    const filtered = list.filter((u: any) => !(u.id === unitId && u.client_id === req.user!.client_id));
    
    if (filtered.length === list.length) {
         return res.status(404).json({ error: 'Unité introuvable.' });
    }
    
    writeJson(SERVICE_UNITS_FILE, filtered);
    res.json({ success: true });
};
