
import { Router } from 'express';
import { getInventory, getCatalog, getLocations, getPartners, getStockOutSafety } from '../controllers/pharmacyController';

const router = Router();

router.get('/inventory', getInventory);
router.get('/catalog', getCatalog);
router.get('/locations', getLocations);
router.get('/partners', getPartners);
router.get('/stock-out-history', getStockOutSafety);

export default router;
