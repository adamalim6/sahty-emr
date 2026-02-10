import express from 'express';
import { 
    getTenants, createTenant, updateTenant, deleteTenant,
    getTenantDetails, updateClientDSI, 
    getOrganismes, createOrganisme, 
    getRoles, getRole, createRole, updateRole,
    getGlobalSuppliers, createGlobalSupplier, updateGlobalSupplier, deleteGlobalSupplier,
    getGroups, getGroup, createGroup, updateGroup, deleteGroup
} from '../controllers/superAdminController';
import { loginGlobalAdmin } from '../controllers/globalAuthController';
import { authenticateGlobalAdmin } from '../middleware/globalAuthMiddleware';

const router = express.Router();

// Global Login
router.post('/login', loginGlobalAdmin);

// Tenants (primary routes)
router.get('/tenants', authenticateGlobalAdmin, getTenants);
router.post('/tenants', authenticateGlobalAdmin, createTenant);
router.get('/tenants/:id', authenticateGlobalAdmin, getTenantDetails);
router.put('/tenants/:id', authenticateGlobalAdmin, updateTenant);
router.put('/tenants/:id/dsi', authenticateGlobalAdmin, updateClientDSI);
router.delete('/tenants/:id', authenticateGlobalAdmin, deleteTenant);

// Backwards-compat aliases (legacy /clients routes)
router.get('/clients', authenticateGlobalAdmin, getTenants);
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

export default router;
