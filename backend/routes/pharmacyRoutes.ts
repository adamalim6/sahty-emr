import { Router } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { prescriptionService } from '../services/prescriptionService';
import * as pharmacyController from '../controllers/pharmacyController';
import { dispenseWithFEFO, getDispensationsByPrescription, getDispensationsByAdmission } from '../controllers/dispensationController';

import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Protect ALL routes with authentication
// router.use(authenticateToken); // Re-enabled for proper access control

// Config & Catalog
router.get('/inventory', pharmacyController.getInventory);
// Fix for stale reads (n-1 version issue)
router.get('/catalog', (req, res, next) => {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
}, pharmacyController.getCatalog);
router.post('/catalog', pharmacyController.createProduct);
router.put('/catalog/:id', pharmacyController.updateProduct);
router.get('/packs', pharmacyController.getSerializedPacks);
router.get('/loose-units', pharmacyController.getLooseUnits);

// Locations
router.get('/locations', pharmacyController.getLocations);
router.get('/locations/by-context', pharmacyController.getLocationsByContext); // Context-based filtering
router.post('/locations', pharmacyController.createLocation);
router.put('/locations/:id', pharmacyController.updateLocation);
router.delete('/locations/:id', pharmacyController.deleteLocation);

// Suppliers
router.get('/suppliers', pharmacyController.getSuppliers);
router.post('/suppliers', pharmacyController.createSupplier);
router.put('/suppliers/:id', pharmacyController.updateSupplier);
router.delete('/suppliers/:id', pharmacyController.deleteSupplier);

router.get('/partners', pharmacyController.getPartners);
router.post('/partners', pharmacyController.createPartner);
router.put('/partners/:id', pharmacyController.updatePartner);
router.delete('/partners/:id', pharmacyController.deletePartner);
router.get('/stock-out-history', pharmacyController.getStockOutSafety);

// Workflow Routes
router.get('/orders', pharmacyController.getPurchaseOrders);
router.post('/orders', pharmacyController.createPurchaseOrder);
router.get('/deliveries', pharmacyController.getDeliveryNotes);
router.post('/deliveries', pharmacyController.createDeliveryNote);
router.post('/quarantine/process', pharmacyController.processQuarantine);

// Dispensation
router.post('/dispensations/fefo', dispenseWithFEFO);
router.get('/dispensations/admission/:admissionId', getDispensationsByAdmission);

// NOTE: Legacy replenishment routes removed - now using /stock-transfers/demands endpoints

router.post('/service-dispense', pharmacyController.dispenseFromServiceStock);

import { createReception, getReturns, getReturnDetails, getReceptions, createReturnDecision, getDecisions, getReceptionDetails } from '../controllers/stockReturnController';

// ... other imports

// Returns (New Engine)
router.get('/returns', getReturns); // Reuse getReturns for list view
router.get('/returns/:id', getReturnDetails); // Reuse details view
router.get('/returns/:id/receptions', getReceptions); // [NEW] Reception History
router.get('/receptions/:id', getReceptionDetails); // [NEW] Reception Details
router.post('/receptions', createReception); // New Atomic Reception
router.post('/receptions/:id/decision', createReturnDecision); // [NEW] Return Decision
router.get('/receptions/:id/decisions', getDecisions); // [NEW] Decision History

// Legacy Returns - Commented out or Removed
// router.post('/returns', pharmacyController.createReturnRequest);
// router.put('/returns/:id/process', pharmacyController.processReturn);
// router.get('/returns/admission/:admissionId', pharmacyController.getReturnsByAdmission);



router.post('/dev/reset', pharmacyController.resetDB);

export default router;
