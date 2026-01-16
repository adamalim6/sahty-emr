
import express from 'express';
import * as globalDCIController from '../controllers/globalDCIController';
import { authenticateGlobalAdmin } from '../middleware/globalAuthMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Public read access for tenants (authenticated via token)
// OR SuperAdmin (who also has token usually, checking authenticateToken is enough for read)
// But for separation, let's allow any authenticated user to read DCIs.
router.get('/', authenticateToken, globalDCIController.getAllDCIs);

// Write access for SuperAdmins only
router.post('/', authenticateGlobalAdmin, globalDCIController.createDCI);
router.put('/:id', authenticateGlobalAdmin, globalDCIController.updateDCI);
router.delete('/:id', authenticateGlobalAdmin, globalDCIController.deleteDCI);

export default router;
