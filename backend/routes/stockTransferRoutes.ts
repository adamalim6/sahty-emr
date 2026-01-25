import express from 'express';
import { stockTransferController } from '../controllers/stockTransferController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Demands
router.get('/catalog', authenticateToken, stockTransferController.getCatalog);
router.post('/demands', authenticateToken, stockTransferController.createDemand);
router.get('/demands', authenticateToken, stockTransferController.getDemands);
router.get('/demands/:demandId', authenticateToken, stockTransferController.getDemandDetails);
router.put('/demands/:demandId/status', authenticateToken, stockTransferController.updateDemandStatus);
router.get('/history/:productId', authenticateToken, stockTransferController.getTransferHistory);

// Transfers
router.post('/transfers', authenticateToken, stockTransferController.createTransfer); // Draft
router.get('/transfers/:transferId', authenticateToken, stockTransferController.getTransfer);
router.post('/transfers/:transferId/execute', authenticateToken, stockTransferController.executeTransfer); // Commit

export default router;
