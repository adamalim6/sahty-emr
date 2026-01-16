
import express from 'express';
import * as globalProductController from '../controllers/globalProductController';
import { authenticateGlobalAdmin } from '../middleware/globalAuthMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Public read access for tenants (authenticated)
router.get('/', authenticateToken, globalProductController.getAllProducts);
router.get('/:id', authenticateToken, globalProductController.getProductById);

// Write access for SuperAdmins only
router.post('/', authenticateGlobalAdmin, globalProductController.createProduct);
router.put('/:id', authenticateGlobalAdmin, globalProductController.updateProduct);
router.delete('/:id', authenticateGlobalAdmin, globalProductController.deleteProduct);

export default router;
