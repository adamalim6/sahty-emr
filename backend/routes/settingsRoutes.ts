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
import { requireModule } from '../middleware/moduleMiddleware';

const router = express.Router();

// Middleware: Authenticated (from server.ts)
router.use(authenticateToken);

// --- USERS & ROLES (Strict Settings Access) ---
router.get('/users', requireModule('SETTINGS'), getMyUsers);
router.post('/users', requireModule('SETTINGS'), createMyUser);
router.put('/users/:id', requireModule('SETTINGS'), updateTenantUser);
router.get('/roles', requireModule('SETTINGS'), getGlobalRoles); // Maybe open?
router.get('/roles/:id', requireModule('SETTINGS'), getGlobalRole);

// --- SERVICES (Read Open, Write Protected) ---
router.get('/services', getServices); // OPEN for all auth users (needed for EMR/Pharmacy)
router.get('/services/:id', getService);
router.post('/services', requireModule('SETTINGS'), createService);
router.put('/services/:id', requireModule('SETTINGS'), updateService);
router.delete('/services/:id', requireModule('SETTINGS'), deleteService);

// --- SERVICE UNITS (Read Open, Write Protected) ---
router.get('/services/:id/units', getServiceUnits);
router.post('/services/:id/units', requireModule('SETTINGS'), createServiceUnit);
router.delete('/services/units/:unitId', requireModule('SETTINGS'), deleteServiceUnit);

// --- ROOMS (Read Open, Write Protected) ---
router.get('/rooms', getRooms);
router.post('/rooms', requireModule('SETTINGS'), createRoom);
router.put('/rooms/:id', requireModule('SETTINGS'), updateRoom);
router.delete('/rooms/:id', requireModule('SETTINGS'), deleteRoom);

// --- PRICING ---
router.get('/pricing', getPricing); // Pricing view might be needed?
router.post('/pricing', requireModule('SETTINGS'), createPricing);

export default router;
