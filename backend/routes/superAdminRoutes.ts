import express from 'express';
import { 
    getTenants, createTenant, updateTenant, deleteTenant,
    getTenantDetails, updateClientDSI, 
    getOrganismes, createOrganisme, 
    getRoles, getRole, createRole, updateRole,
    getGlobalSuppliers, createGlobalSupplier, updateGlobalSupplier, deleteGlobalSupplier,
    getGroups, getGroup, createGroup, updateGroup, deleteGroup,
    updateTenantReferenceSchema, updateAllReferenceSchemas
} from '../controllers/superAdminController';
import { 
    getGlobalActes, createGlobalActe, updateGlobalActe, deleteGlobalActe,
    getFamilles, createFamille, updateFamille, deleteFamille,
    getSousFamilles, createSousFamille, updateSousFamille, deleteSousFamille
} from '../controllers/superadmin.globalActes.controller';
import { loginGlobalAdmin } from '../controllers/globalAuthController';
import { authenticateGlobalAdmin } from '../middleware/globalAuthMiddleware';
import {
    getFlowsheets, createFlowsheet, updateFlowsheet,
    getUnits, createUnit, updateUnit,
    getRoutes, createRoute, updateRoute,
    getGroups as getObsGroups, createGroup as createObsGroup, updateGroup as updateObsGroup,
    getParameters, createParameter, updateParameter
} from '../controllers/superadminObservationCatalogController';
import {
    getCareCategories, createCareCategory, updateCareCategory
} from '../controllers/superadminCareCategoryController';
import * as smartPhrasesController from '../controllers/smartPhrasesController';

const router = express.Router();

// --- SMART PHRASES MODULE (SYSTEM TEMPLATES) ---

// --- SMART PHRASES MODULE (SYSTEM TEMPLATES) ---
router.get('/smart-phrases', authenticateGlobalAdmin, smartPhrasesController.getSystemPhrases);
router.post('/smart-phrases', authenticateGlobalAdmin, smartPhrasesController.createSystemPhrase);
router.put('/smart-phrases/:id', authenticateGlobalAdmin, smartPhrasesController.updateSystemPhrase);

// --- OBSERVATION CATALOG (GLOBAL CRUD) ---

// Global Login
router.post('/login', loginGlobalAdmin);

// Tenants (primary routes)
router.get('/tenants', authenticateGlobalAdmin, getTenants);
router.post('/tenants', authenticateGlobalAdmin, createTenant);
router.post('/tenants/update-all-reference-schemas', authenticateGlobalAdmin, updateAllReferenceSchemas);
router.post('/tenants/:id/update-reference-schema', authenticateGlobalAdmin, updateTenantReferenceSchema);
router.get('/tenants/:id', authenticateGlobalAdmin, getTenantDetails);
router.put('/tenants/:id', authenticateGlobalAdmin, updateTenant);
router.put('/tenants/:id/dsi', authenticateGlobalAdmin, updateClientDSI);
router.delete('/tenants/:id', authenticateGlobalAdmin, deleteTenant);

// Backwards-compat aliases (legacy /clients routes)
router.get('/clients', authenticateGlobalAdmin, getTenants);

// Reference: Actes
router.get('/reference/actes', authenticateGlobalAdmin, getGlobalActes);
router.post('/reference/actes', authenticateGlobalAdmin, createGlobalActe);
router.put('/reference/actes/:id', authenticateGlobalAdmin, updateGlobalActe);
router.delete('/reference/actes/:id', authenticateGlobalAdmin, deleteGlobalActe);

// Reference: Familles
router.get('/reference/familles', authenticateGlobalAdmin, getFamilles);
router.post('/reference/familles', authenticateGlobalAdmin, createFamille);
router.put('/reference/familles/:id', authenticateGlobalAdmin, updateFamille);
router.delete('/reference/familles/:id', authenticateGlobalAdmin, deleteFamille);

// Reference: Sous-Familles
router.get('/reference/sous-familles', authenticateGlobalAdmin, getSousFamilles);
router.post('/reference/sous-familles', authenticateGlobalAdmin, createSousFamille);
router.put('/reference/sous-familles/:id', authenticateGlobalAdmin, updateSousFamille);
router.delete('/reference/sous-familles/:id', authenticateGlobalAdmin, deleteSousFamille);

router.post('/clients', authenticateGlobalAdmin, createTenant);
router.get('/clients/:id', authenticateGlobalAdmin, getTenantDetails);
router.put('/clients/:id', authenticateGlobalAdmin, updateTenant);
router.put('/clients/:id/dsi', authenticateGlobalAdmin, updateClientDSI);
router.delete('/clients/:id', authenticateGlobalAdmin, deleteTenant);

// Organismes
router.get('/organismes', authenticateGlobalAdmin, getOrganismes);
router.post('/organismes', authenticateGlobalAdmin, createOrganisme);

// Roles
router.get('/roles', authenticateGlobalAdmin, getRoles);
router.get('/roles/:id', authenticateGlobalAdmin, getRole);
router.post('/roles', authenticateGlobalAdmin, createRole);
router.put('/roles/:id', authenticateGlobalAdmin, updateRole);

// Global Suppliers
router.get('/suppliers', authenticateGlobalAdmin, getGlobalSuppliers);
router.post('/suppliers', authenticateGlobalAdmin, createGlobalSupplier);
router.put('/suppliers/:id', authenticateGlobalAdmin, updateGlobalSupplier);
router.delete('/suppliers/:id', authenticateGlobalAdmin, deleteGlobalSupplier);

// Groups
router.get('/groups', authenticateGlobalAdmin, getGroups);
router.post('/groups', authenticateGlobalAdmin, createGroup);
router.get('/groups/:id', authenticateGlobalAdmin, getGroup);
router.put('/groups/:id', authenticateGlobalAdmin, updateGroup);
router.delete('/groups/:id', authenticateGlobalAdmin, deleteGroup);

// --- OBSERVATION CATALOG (GLOBAL CRUD) ---
router.get('/observation/flowsheets', authenticateGlobalAdmin, getFlowsheets);
router.post('/observation/flowsheets', authenticateGlobalAdmin, createFlowsheet);
router.put('/observation/flowsheets/:id', authenticateGlobalAdmin, updateFlowsheet);
router.get('/observation/groups', authenticateGlobalAdmin, getObsGroups);
router.post('/observation/groups', authenticateGlobalAdmin, createObsGroup);
router.put('/observation/groups/:id', authenticateGlobalAdmin, updateObsGroup);
router.get('/observation/parameters', authenticateGlobalAdmin, getParameters);
router.post('/observation/parameters', authenticateGlobalAdmin, createParameter);
router.put('/observation/parameters/:id', authenticateGlobalAdmin, updateParameter);
router.get('/observation/units', authenticateGlobalAdmin, getUnits);
router.post('/observation/units', authenticateGlobalAdmin, createUnit);
router.put('/observation/units/:id', authenticateGlobalAdmin, updateUnit);
router.get('/observation/routes', authenticateGlobalAdmin, getRoutes);
router.post('/observation/routes', authenticateGlobalAdmin, createRoute);
router.put('/observation/routes/:id', authenticateGlobalAdmin, updateRoute);

// --- CARE CATEGORIES ---
router.get('/care-categories', authenticateGlobalAdmin, getCareCategories);
router.post('/care-categories', authenticateGlobalAdmin, createCareCategory);
router.put('/care-categories/:id', authenticateGlobalAdmin, updateCareCategory);

export default router;
