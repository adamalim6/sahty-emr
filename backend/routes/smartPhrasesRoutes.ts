import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import * as smartPhrasesController from '../controllers/smartPhrasesController';

const router = Router();

router.use(authenticateToken);

router.get('/', smartPhrasesController.getPhrasesForUser);
router.post('/', smartPhrasesController.createPhrase);
router.post('/compile', smartPhrasesController.compilePhrase);
router.patch('/:id', smartPhrasesController.updatePhrase);

export default router;
