import express from 'express';
import { getTenantActes, getTenantActeById } from '../controllers/tenant.referenceActes.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Tenant EMR reference routes (read-only)
router.get('/', authenticateToken, getTenantActes);
router.get('/:id', authenticateToken, getTenantActeById);

export default router;
