import express from 'express';
import { 
    getClients, createClient, updateClient, deleteClient,
    getClientDetails, updateClientDSI, 
    getOrganismes, createOrganisme, 
    getRoles, getRole, createRole, updateRole,
    getGlobalSuppliers, createGlobalSupplier, updateGlobalSupplier, deleteGlobalSupplier // Updated imports
} from '../controllers/superAdminController';
import { loginGlobalAdmin } from '../controllers/globalAuthController';
import { authenticateGlobalAdmin } from '../middleware/globalAuthMiddleware';

const router = express.Router();

// Global Login
router.post('/login', loginGlobalAdmin);

// Clients
router.get('/clients', authenticateGlobalAdmin, getClients);
router.post('/clients', authenticateGlobalAdmin, createClient);
router.get('/clients/:id', authenticateGlobalAdmin, getClientDetails);
router.put('/clients/:id', authenticateGlobalAdmin, updateClient);
router.put('/clients/:id/dsi', authenticateGlobalAdmin, updateClientDSI);
router.delete('/clients/:id', authenticateGlobalAdmin, deleteClient);

// Organismes
router.get('/organismes', authenticateGlobalAdmin, getOrganismes);
router.post('/organismes', authenticateGlobalAdmin, createOrganisme);

// Roles
// Note: Roles can be read by tenants via settings, these are likely managing GLOBAL templates if any? 
// Or managing tenant roles as superadmin.
router.get('/roles', authenticateGlobalAdmin, getRoles);
router.get('/roles/:id', authenticateGlobalAdmin, getRole);
router.post('/roles', authenticateGlobalAdmin, createRole);
router.put('/roles/:id', authenticateGlobalAdmin, updateRole);

// Global Suppliers
router.get('/suppliers', authenticateGlobalAdmin, getGlobalSuppliers);
router.post('/suppliers', authenticateGlobalAdmin, createGlobalSupplier);
router.put('/suppliers/:id', authenticateGlobalAdmin, updateGlobalSupplier);
router.delete('/suppliers/:id', authenticateGlobalAdmin, deleteGlobalSupplier);

export default router;
