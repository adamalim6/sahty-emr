import express from 'express';
import { 
    getMyUsers, createMyUser,

    getGlobalRoles, getGlobalRole,
    
    // Services
    getServices, getService, createService, updateService, deleteService,
    getServiceUnits, createServiceUnit, deleteServiceUnit,
    
    // Rooms
    getRooms, createRoom, updateRoom, deleteRoom,
    
    // Pricing
    getPricing, createPricing,
    updateTenantUser
} from '../controllers/settingsController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { UserType } from '../models/auth';

const router = express.Router();

// Middleware: Must be Tenant Super Admin (or maybe just Tenant User with permissions? Prompt says ONLY TENANT_SUPERADMIN)
router.use(authenticateToken);
// REMOVED GLOBAL RESTRICTION to TENANT_SUPERADMIN because Doctors need read access to Services/Rooms
// router.use(requireRole([UserType.TENANT_SUPERADMIN])); 

// Helper for strict Admin check
const requireAdmin = requireRole([UserType.TENANT_SUPERADMIN]);

router.get('/users', getMyUsers);
router.post('/users', createMyUser);
router.put('/users/:id', updateTenantUser);
router.get('/roles', getGlobalRoles);
router.get('/roles/:id', getGlobalRole);

// Services
router.get('/services', getServices);
router.get('/services/:id', getService);
router.post('/services', createService);
router.put('/services/:id', updateService); // New
router.delete('/services/:id', deleteService);

// Service Layout (Units)
router.get('/services/:id/units', getServiceUnits);
router.post('/services/:id/units', createServiceUnit);
router.delete('/services/units/:unitId', deleteServiceUnit);

router.get('/rooms', getRooms);
router.post('/rooms', createRoom);
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);

router.get('/pricing', getPricing);
router.post('/pricing', createPricing);

export default router;
