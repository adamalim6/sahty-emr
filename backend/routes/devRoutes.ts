
import { Router } from 'express';
import { resetData } from '../controllers/devController';

const router = Router();

router.post('/reset', resetData);

export default router;
