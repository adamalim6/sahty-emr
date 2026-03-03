import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { 
    getActiveEscarres, 
    createEscarre, 
    getEscarreDetails, 
    addSnapshot, 
    deactivateEscarre 
} from '../controllers/escarresController';

const router = Router();

// Secure all Escarres endpoints behind authenticated token middleware
router.use(authenticateToken);

// GET active escarres and latest snapshots for a specific patient in tenant
router.get('/tenant_patients/:tenantPatientId', getActiveEscarres);

// POST atomic creation of base + first snapshot
router.post('/', createEscarre);

// GET full immutable history for a single escarre
router.get('/:id', getEscarreDetails);

// POST explicitly append new clinical snapshots (cannot modify base pos_x/y/z or prior history)
router.post('/:id/snapshots', addSnapshot);

// PATCH resolve/deactivate escarre natively keeping history intact
router.patch('/:id/deactivate', deactivateEscarre);

export default router;
