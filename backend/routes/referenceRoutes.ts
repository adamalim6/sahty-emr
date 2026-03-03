import express from 'express';
import * as globalProductController from '../controllers/globalProductController';
import * as globalDCIController from '../controllers/globalDCIController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

// Expose tenant-scoped catalog reads 
router.get('/products', globalProductController.getAllProducts);
router.get('/products/:id', globalProductController.getProductById);
router.get('/products/:id/price-history', globalProductController.getProductPriceHistory);

router.get('/dci', globalDCIController.getAllDCIs);

export default router;
