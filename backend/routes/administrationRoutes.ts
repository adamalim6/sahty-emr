import { Router } from 'express';
import { administrationController } from '../controllers/administrationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Secure all routes
router.use(authenticateToken);

// New orchestration endpoint for Biology Collection
router.post('/log-with-biology', administrationController.logWithBiology);

export default router;
