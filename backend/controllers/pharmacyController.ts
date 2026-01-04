
import { Request, Response } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { returnService } from '../services/returnService';
import { ReturnDestination } from '../models/return-request';

export const getInventory = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const serviceId = req.query.serviceId as string;
        
        // Strict Service Scoping
        if (serviceId) {
            const userServices = req.user?.service_ids || [];
            if (!userServices.includes(serviceId) && req.user?.user_type !== 'TENANT_SUPERADMIN') { // Superadmin might bypass? Or strict? Let's be strict for now or allow superadmin.
                 // Actually, let's stick to the plan: "If serviceId is provided but not in req.user.service_ids -> Return 403"
                 // Assuming req.user has service_ids. If not, we might need to fetch them. 
                 // But for now let's implement the check.
                 if (!userServices.includes(serviceId)) {
                     return res.status(403).json({ message: "Accès refusé : Vous n'êtes pas affecté à ce service." });
                 }
            }
        }
        
        const inventory = pharmacyService.getInventory(tenantId, serviceId);
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching inventory' });
    }
};

export const getCatalog = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        // console.log(`[API] getCatalog request from User: ${req.user?.username}, Tenant: ${tenantId}`);
        const catalog = pharmacyService.getCatalog(tenantId);
        // console.log(`[API] Returning ${catalog.length} products dynamically calculated.`);
        res.json(catalog);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching catalog' });
    }
};

export const createProduct = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const product = pharmacyService.addProduct({ ...req.body, tenantId });
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error creating product' });
    }
};


export const getSerializedPacks = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const packs = pharmacyService.getSerializedPacks({ tenantId });
        res.json(packs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching packs' });
    }
};

export const getLocations = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const serviceId = req.query.serviceId as string;
        const scope = req.query.scope as 'PHARMACY' | 'SERVICE';
        
        // Strict Service Authorization for Locations
        if (serviceId) {
             const userServices = req.user?.service_ids || [];
              if (!userServices.includes(serviceId) && req.user?.user_type !== 'TENANT_SUPERADMIN') { // Allow superadmin to see all locations?
                  return res.status(403).json({ message: "Accès refusé : Vous n'êtes pas affecté à ce service." });
              }
        }

        const locations = pharmacyService.getLocations(tenantId, serviceId, scope);
        res.json(locations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching locations' });
    }
};

export const createLocation = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        // Body should contain serviceId
        const locationData = { ...req.body, tenantId };
        const location = pharmacyService.addLocation(locationData);
        res.status(201).json(location);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating location' });
    }
};

export const updateLocation = (req: Request, res: Response) => {
    try {
        const location = req.body;
        // Ensure ID in body matches ID in params
        if (req.params.id && location.id !== req.params.id) {
            location.id = req.params.id;
        }
        const updated = pharmacyService.updateLocation(location);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating location' });
    }
};

export const deleteLocation = (req: Request, res: Response) => {
    try {
        pharmacyService.deleteLocation(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting location' });
    }
};

// Supplier Handlers
export const getSuppliers = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const suppliers = pharmacyService.getSuppliers(tenantId);
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching suppliers' });
    }
};

export const createSupplier = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const supplier = pharmacyService.addSupplier({ ...req.body, tenantId });
        res.status(201).json(supplier);
    } catch (error) {
        res.status(500).json({ message: 'Error creating supplier' });
    }
};

export const updateSupplier = (req: Request, res: Response) => {
    try {
        const supplier = req.body;
        if (req.params.id && supplier.id !== req.params.id) {
            supplier.id = req.params.id;
        }
        const updated = pharmacyService.updateSupplier(supplier);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating supplier' });
    }
};

export const deleteSupplier = (req: Request, res: Response) => {
    try {
        pharmacyService.deleteSupplier(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting supplier' });
    }
};

// Product Updates

export const updateProduct = (req: any, res: Response) => {
    try {
        const tenantId = req.user?.client_id;
        const product = { ...req.body, tenantId };
        const updated = pharmacyService.updateProduct(product);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating product' });
    }
};

export const getPartners = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const partners = pharmacyService.getPartners(tenantId);
        res.json(partners);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching partners' });
    }
};

export const createPartner = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const partner = pharmacyService.addPartner({ ...req.body, tenantId });
        res.status(201).json(partner);
    } catch (error) {
        res.status(500).json({ message: 'Error creating partner' });
    }
};

export const updatePartner = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const partner = { ...req.body, tenantId }; // Pass tenantId for verification
        if (req.params.id && partner.id !== req.params.id) {
            partner.id = req.params.id;
        }
        const updated = pharmacyService.updatePartner(partner);
        res.json(updated);
    } catch (error: any) {
        res.status(403).json({ message: error.message || 'Error updating partner' });
    }
};

export const deletePartner = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        pharmacyService.deletePartner(req.params.id, tenantId);
        res.status(204).send();
    } catch (error: any) {
        res.status(403).json({ message: error.message || 'Error deleting partner' });
    }
};

export const getStockOutSafety = (req: Request, res: Response) => {
    try {
        const history = pharmacyService.getStockOutHistory();
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock out history' });
    }
};

// Workflow Endpoints

export const getPurchaseOrders = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const pos = pharmacyService.getPurchaseOrders(tenantId);
        res.json(pos);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching POs' });
    }
};

export const createPurchaseOrder = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const po = pharmacyService.createPurchaseOrder({ ...req.body, tenantId });
        res.status(201).json(po);
    } catch (error) {
        res.status(500).json({ message: 'Error creating PO' });
    }
};

export const getDeliveryNotes = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const notes = pharmacyService.getDeliveryNotes(tenantId);
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching deliveries' });
    }
};

export const createDeliveryNote = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const note = pharmacyService.createDeliveryNote({ ...req.body, tenantId });
        res.status(201).json(note);
    } catch (error) {
        res.status(500).json({ message: 'Error creating delivery note' });
    }
};

export const processQuarantine = (req: Request, res: Response) => {
    try {
        const result = pharmacyService.processQuarantine(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error processing quarantine' });
    }
};


// Replenishment Endpoints
export const getReplenishmentRequests = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const requests = pharmacyService.getReplenishmentRequests(tenantId);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching replenishment requests' });
    }
};

export const createReplenishmentRequest = (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id;
        const request = pharmacyService.createReplenishmentRequest({ ...req.body, tenantId });
        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Error creating replenishment request' });
    }
};

export const updateReplenishmentRequestStatus = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, processedRequest } = req.body; // processedRequest contains prepared items
        const updated = pharmacyService.updateReplenishmentRequestStatus(id, status, processedRequest);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating request status' });
    }
};

export const dispenseItem = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = pharmacyService.dispenseItem({
            requestId: id,
            ...req.body
        });
        res.json(result);
    } catch (error: any) {
        console.error('Error dispensing item:', error);
        res.status(500).json({ message: error.message || 'Error dispensing item' });
    }
};

export const dispenseFromServiceStock = (req: Request, res: Response) => {
    try {
        const result = pharmacyService.dispenseFromServiceStock(req.body);
        res.json(result);
    } catch (error: any) {
        console.error('Error dispensing from service stock:', error);
        res.status(500).json({ message: error.message || 'Error dispensing from service stock' });
    }
};

// Returns
export const createReturnRequest = (req: Request, res: Response) => {
    try {
        const { admissionId, items, destination, userId, targetLocationId, serviceId } = req.body;
        const request = returnService.createReturnRequest(admissionId, items, destination, userId || 'system', targetLocationId, serviceId);
        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating return request:', error);
        res.status(500).json({ message: 'Error creating return request' });
    }
};

export const getReturns = (req: Request, res: Response) => {
    try {
        const returns = returnService.getAllRequests();
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching returns' });
    }
};

export const processReturn = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, userId } = req.body;
        returnService.processReturnDecision(id, decision, userId || 'system');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing return:', error);
        res.status(500).json({ message: 'Error processing return' });
    }
};

export const processReturnSplit = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decisions, userId } = req.body;
        returnService.processReturnSplitDecision(id, decisions, userId || 'system');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing split return:', error);
        res.status(500).json({ message: 'Error processing split return' });
    }
};

export const getReturnsByAdmission = (req: Request, res: Response) => {
    try {
        const { admissionId } = req.params;
        const returns = returnService.getReturnsByAdmission(admissionId);
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admission returns' });
    }
};
