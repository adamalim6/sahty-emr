import express from 'express';
import { 
    getMyUsers, createMyUser,

    getGlobalRoles, getGlobalRole,
    
    // Services
    getServices, getService, createService, updateService, deleteService,
    getServiceUnits, createServiceUnit, deleteServiceUnit, deactivateServiceUnit, reactivateServiceUnit,
    
    // Rooms
    getRooms, createRoom, updateRoom, deleteRoom,

    // Technical Unit Types
    getTechnicalUnitTypes, createTechnicalUnitType, updateTechnicalUnitType, deleteTechnicalUnitType,

    // Pricing
    getPricing, createPricing,
    updateTenantUser,
    getRoutes
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
router.put('/services/units/:unitId/deactivate', requireModule('SETTINGS'), deactivateServiceUnit);
router.put('/services/units/:unitId/reactivate', requireModule('SETTINGS'), reactivateServiceUnit);

import {
    getBeds, createBed, updateBedStatus, deactivateBed,
    getServiceRooms, createPhysicalRoom, updatePhysicalRoom, deactivatePhysicalRoom,
    getBedOccupancy
} from '../controllers/placementController';

// --- ROOMS (Read Open, Write Protected) ---
router.get('/rooms', getRooms);
router.post('/rooms', requireModule('SETTINGS'), createRoom);
router.put('/rooms/:id', requireModule('SETTINGS'), updateRoom);
router.delete('/rooms/:id', requireModule('SETTINGS'), deleteRoom);

// --- PHYSICAL ROOMS (by service) ---
router.get('/physical-rooms', getServiceRooms);
router.get('/physical-rooms/service/:serviceId', getServiceRooms);
router.post('/physical-rooms', requireModule('SETTINGS'), createPhysicalRoom);
router.put('/physical-rooms/:id', requireModule('SETTINGS'), updatePhysicalRoom);
router.delete('/physical-rooms/:id', requireModule('SETTINGS'), deactivatePhysicalRoom);

// --- BEDS ---
router.get('/rooms/:roomId/beds', getBeds);
router.post('/rooms/:roomId/beds', requireModule('SETTINGS'), createBed);
router.put('/beds/:bedId/status', requireModule('SETTINGS'), updateBedStatus);
router.delete('/beds/:bedId', requireModule('SETTINGS'), deactivateBed);

// --- BED OCCUPANCY (by service) ---
router.get('/occupancy/:serviceId', getBedOccupancy);

// --- TECHNICAL UNIT TYPES (Plateaux Techniques) ---
router.get('/technical-unit-types', getTechnicalUnitTypes);
router.post('/technical-unit-types', requireModule('SETTINGS'), createTechnicalUnitType);
router.put('/technical-unit-types/:id', requireModule('SETTINGS'), updateTechnicalUnitType);
router.delete('/technical-unit-types/:id', requireModule('SETTINGS'), deleteTechnicalUnitType);

// --- PRICING ---
router.get('/pricing', getPricing); // Pricing view might be needed?
router.post('/pricing', requireModule('SETTINGS'), createPricing);

import {
    getFlowsheets, getGroups, getParameters, getUnits
} from '../controllers/emrObservationCatalogController';

// --- OBSERVATION CATALOG (Surveillance Flowsheets) ---
router.get('/observation/flowsheets', getFlowsheets);
router.get('/observation/groups', getGroups);
router.get('/observation/parameters', getParameters);

// --- UNITS CATALOG ---
router.get('/observation/units', getUnits);

// --- ROUTES CATALOG ---
router.get('/observation/routes', getRoutes);

export default router;
