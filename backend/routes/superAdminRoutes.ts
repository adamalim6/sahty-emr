import express from 'express';
import { 
    getClients, createClient, updateClient, deleteClient,
    getClientDetails, updateClientDSI, 
    getOrganismes, createOrganisme, 
    getRoles, getRole, createRole, updateRole,
    getGlobalSuppliers, createGlobalSupplier, updateGlobalSupplier, deleteGlobalSupplier // Updated imports
} from '../controllers/superAdminController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = express.Router();

// Clients
router.get('/clients', authenticateToken, getClients);
router.post('/clients', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), createClient);
router.get('/clients/:id', authenticateToken, getClientDetails); // New
router.put('/clients/:id', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), updateClient);
router.put('/clients/:id/dsi', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), updateClientDSI); // New
router.delete('/clients/:id', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), deleteClient);

// Organismes
router.get('/organismes', authenticateToken, getOrganismes);
router.post('/organismes', authenticateToken, createOrganisme);

// Roles
router.get('/roles', authenticateToken, getRoles); // Allow Tenants to read
router.get('/roles/:id', authenticateToken, getRole); // Allow Tenants to read
router.post('/roles', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), createRole); // New
router.put('/roles/:id', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), updateRole); // New

// Global Suppliers
router.get('/suppliers', authenticateToken, getGlobalSuppliers);
router.post('/suppliers', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), createGlobalSupplier);
router.put('/suppliers/:id', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), updateGlobalSupplier);
router.delete('/suppliers/:id', authenticateToken, requireRole(['PUBLISHER_SUPERADMIN']), deleteGlobalSupplier);

export default router;
