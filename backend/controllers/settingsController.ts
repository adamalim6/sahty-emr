
import { Request, Response } from 'express';
import { AuthRequest, getTenantId } from '../middleware/authMiddleware';
import { settingsService, ServiceDefinition, UnitType, ServiceUnit, Pricing } from '../services/settingsService';
import { globalAdminService } from '../services/globalAdminService';
import { authUserRepository } from '../repositories/authUserRepository';
import { authService } from '../services/authService';
import { User, UserType } from '../models/auth';
import { v4 as uuidv4 } from 'uuid';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    return { tenantId, user: (req as any).user };
};

// --- Users ---
export const getMyUsers = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const users = await authUserRepository.findAll(tenantId);
        // Mask password hash
        const safeUsers = users.map(u => {
            const { password_hash, ...rest } = u;
            return rest;
        });
        res.json(safeUsers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createMyUser = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { username, password, nom, prenom, role_id, INPE, service_ids } = req.body;

        // RBAC Security: Tenant Admin cannot assign SUPER_ADMIN or ADMIN_STRUCTURE roles
        const allRoles = await settingsService.getRoles(tenantId);
        const targetRole = allRoles.find(r => r.id === role_id);
        
        if (targetRole && ['SUPER_ADMIN', 'ADMIN_STRUCTURE'].includes(targetRole.code)) {
            return res.status(403).json({ 
                error: 'RBAC Violation: Vous n\'êtes pas autorisé à assigner ce rôle système.' 
            });
        }

        const newUser: Partial<User> = {
            id: uuidv4(),
            tenantId: tenantId,
            username,
            password_hash: authService.hashPassword(password),
            nom,
            prenom,
            user_type: UserType.TENANT_USER,
            role_id,
            INPE,
            service_ids: service_ids || []
        };

        const created = await authUserRepository.create(newUser, tenantId);
        const { password_hash, ...safeUser } = created;
        res.status(201).json(safeUser);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateTenantUser = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const updates = req.body;
        
        // Fetch current to check logic
        const currentUser = await authUserRepository.findById(id, tenantId);
        
        if (!currentUser) return res.status(404).json({ error: 'User not found' });
        
        // Check if user is DSI (Admin Structure)
        const userRole = (await settingsService.getRoles(tenantId)).find(r => r.id === currentUser.role_id);
        
        if (currentUser.role_id === 'role_admin_struct' || userRole?.code === 'ADMIN_STRUCTURE') {
             return res.status(403).json({ error: 'Modification interdite pour l\'administrateur principal.' });
        }

        if (updates.password) {
            updates.password_hash = authService.hashPassword(updates.password);
            delete updates.password;
        }

        const updated = await authUserRepository.update(id, updates, tenantId);
        const { password_hash, ...safeUser } = updated;
        res.json(safeUser);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// --- Roles ---
// RBAC: Tenant Admins can only see roles assignable_by = 'TENANT_ADMIN'
// We filter by code since assignable_by might not be synced to Tenant DB yet.
const SYSTEM_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN_STRUCTURE'];

export const getGlobalRoles = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const allRoles = await settingsService.getRoles(tenantId);
        
        // Return all roles - frontend handles filtering for assignment dropdown
        // This allows display of system role names (like ADMIN_STRUCTURE) in the user list
        res.json(allRoles);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getGlobalRole = async (req: Request, res: Response) => {
    try {
        const role = await globalAdminService.getGlobalRole(req.params.id);
        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.json(role);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// --- Services ---
export const getServices = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const services = await settingsService.getServices(tenantId);
        res.json(services);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getService = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const services = await settingsService.getServices(tenantId);
        const service = services.find(s => s.id === req.params.id);
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

import { pharmacyService } from '../services/pharmacyService'; // Import Service

export const createService = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const newService: ServiceDefinition = {
            id: uuidv4(),
            tenantId,
            ...req.body
        };
        const created = await settingsService.createService(tenantId, newService);
        
        // 🔗 LINKING: Automatically Initialize Physical Service Ledger
        try {
            pharmacyService.initServiceLedger(tenantId, created.id);
        } catch (e) {
            console.error("Warning: Failed to init service ledger", e);
            // Non-blocking, but logged.
        }

        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateService = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const updated = await settingsService.updateService(tenantId, { ...req.body, id });
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteService = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await settingsService.deleteService(tenantId, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// --- Rooms (Unit Types) ---
export const getRooms = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const rooms = await settingsService.getUnitTypes(tenantId);
        res.json(rooms);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const created = await settingsService.createUnitType(tenantId, req.body);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const updated = await settingsService.updateUnitType(tenantId, { ...req.body, id });
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await settingsService.deleteUnitType(tenantId, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// --- Pricing ---
export const getPricing = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const pricing = await settingsService.getPricing(tenantId);
        res.json(pricing);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPricing = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const newPricing: Pricing = {
            id: `prc_${Date.now()}`,
            tenantId,
            ...req.body
        };
        const created = await settingsService.createPricing(tenantId, newPricing);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// --- Service Units ---
export const getServiceUnits = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id: serviceId } = req.params;
        const units = await settingsService.getServiceUnits(tenantId, serviceId);
        res.json(units);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createServiceUnit = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const newItem: ServiceUnit = {
            id: '',  // generated by DB via gen_random_uuid()
            service_id: req.params.id,
            unit_type_id: req.body.unit_type_id,
            name: req.body.name,
            created_at: '',
            tenantId,
        };
        const created = await settingsService.createServiceUnit(tenantId, newItem);
        res.status(201).json(created);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteServiceUnit = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { unitId } = req.params;
        await settingsService.deleteServiceUnit(tenantId, unitId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deactivateServiceUnit = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { unitId } = req.params;
        await settingsService.deactivateServiceUnit(tenantId, unitId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const reactivateServiceUnit = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { unitId } = req.params;
        await settingsService.reactivateServiceUnit(tenantId, unitId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
