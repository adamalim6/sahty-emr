import { Router } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { prescriptionService } from '../services/prescriptionService';
import * as pharmacyController from '../controllers/pharmacyController';
import { dispenseWithFEFO, getDispensationsByPrescription, getDispensationsByAdmission } from '../controllers/dispensationController';

const router = Router();



// Config & Catalog
router.get('/inventory', pharmacyController.getInventory);
router.get('/catalog', pharmacyController.getCatalog);
router.post('/catalog', pharmacyController.createProduct);
router.put('/catalog/:id', pharmacyController.updateProduct);
// Locations
router.get('/locations', pharmacyController.getLocations);
router.post('/locations', pharmacyController.createLocation);
router.put('/locations/:id', pharmacyController.updateLocation);
router.delete('/locations/:id', pharmacyController.deleteLocation);

// Suppliers
router.get('/suppliers', pharmacyController.getSuppliers);
router.post('/suppliers', pharmacyController.createSupplier);
router.put('/suppliers/:id', pharmacyController.updateSupplier);
router.delete('/suppliers/:id', pharmacyController.deleteSupplier);

router.get('/partners', pharmacyController.getPartners);
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

// Replenishment
router.get('/replenishments', pharmacyController.getReplenishmentRequests);
router.post('/replenishments', pharmacyController.createReplenishmentRequest);
router.put('/replenishments/:id/status', pharmacyController.updateReplenishmentRequestStatus);
router.post('/service-dispense', pharmacyController.dispenseFromServiceStock);

// Returns
router.post('/returns', pharmacyController.createReturnRequest);
router.get('/returns', pharmacyController.getReturns);
router.put('/returns/:id/process', pharmacyController.processReturn);
router.get('/returns/admission/:admissionId', pharmacyController.getReturnsByAdmission);




export default router;
