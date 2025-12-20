
import { Router } from 'express';
import { getSerializedPacks, getSerializedPackById } from '../controllers/serializedPackController';

const router = Router();

router.get('/packs', getSerializedPacks);
router.get('/packs/:id', getSerializedPackById);

export default router;
