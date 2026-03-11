import { Router } from 'express';
import { 
    getPatientAllergies, 
    createAllergy, 
    updateAllergy, 
    changeAllergyStatus, 
    getAllergyHistory 
} from '../controllers/allergiesController';
import { authenticateToken, requireTenant } from '../middleware/authMiddleware';

const router = Router();

// Base Auth + Tenant context
router.use(authenticateToken);
router.use(requireTenant);

router.get('/patient/:tenantPatientId', getPatientAllergies);
router.post('/patient/:tenantPatientId', createAllergy);
router.patch('/:id', updateAllergy);
router.patch('/:id/status', changeAllergyStatus);
router.get('/:id/history', getAllergyHistory);

export default router;
