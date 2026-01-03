
import express from 'express';
import { login, me } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateToken, me);

export default router;
