import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { hprimController } from '../controllers/hprimController';

const router = Router();

router.post('/trigger-orm/:specimenId', authenticateToken, hprimController.triggerOrm);
router.get('/messages', authenticateToken, hprimController.listMessages);
router.post('/retry/:messageId', authenticateToken, hprimController.retryMessage);
router.get('/links', authenticateToken, hprimController.listLinks);

export default router;
