import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { smartValuesController } from '../controllers/smartValuesController';

const router = Router();

router.use(authenticateToken);

router.get('/:trigger', smartValuesController.resolveSmartValue);

export default router;
