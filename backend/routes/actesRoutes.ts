import express from 'express';
import { getActes, updateActe } from '../controllers/actesController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', authenticateToken, getActes);
router.put('/:code', authenticateToken, updateActe);

export default router;
