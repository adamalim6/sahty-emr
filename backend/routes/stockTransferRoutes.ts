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
router.post('/demands/:demandId/claim', authenticateToken, stockTransferController.claimDemand);
router.post('/demands/:demandId/release', authenticateToken, stockTransferController.releaseDemand);
router.get('/history/:productId', authenticateToken, stockTransferController.getTransferHistory);

// Service Locations (for EMR users creating demands)
router.get('/service-locations', authenticateToken, stockTransferController.getServiceLocations);

// Transfers
router.post('/transfers', authenticateToken, stockTransferController.createTransfer); // Draft
router.get('/transfers/:transferId', authenticateToken, stockTransferController.getTransfer);
router.post('/transfers/:transferId/execute', authenticateToken, stockTransferController.executeTransfer); // Commit

export default router;
