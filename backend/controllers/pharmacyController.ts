
import { Request, Response } from 'express';
import { pharmacyService } from '../services/pharmacyService';
import { getTenantId } from '../middleware/authMiddleware';
import { ReturnDestination, ReturnRequest, ReturnRequestStatus } from '../models/return-request';
import { Container, ContainerType, ContainerState } from '../models/container';

// Helper to ensure tenant context
const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    return { tenantId, user: (req as any).user };
};

export const getInventory = (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const serviceId = req.query.serviceId as string;
        
        if (serviceId) {
            const userServices = user?.service_ids || [];
            if (!userServices.includes(serviceId) && user?.user_type !== 'TENANT_SUPERADMIN') {
                return res.status(403).json({ message: "Accès refusé : Vous n'êtes pas affecté à ce service." });
            }
        }
        
        // Use legacy inventory view for now
        const inventory = pharmacyService.getInventory(tenantId);
        // Filter by service if strictly needed or if inventory has serviceId field?
        // Legacy inventory items have 'serviceId' optional.
        if (serviceId) {
            const filtered = inventory.filter(i => i.serviceId === serviceId);
            return res.json(filtered);
        }
        res.json(inventory);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCatalog = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const catalog = pharmacyService.getCatalog(tenantId);
        res.json(catalog);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createProduct = (req: Request, res: Response) => {
    try {
        // Tenants cannot create Global Products.
        // This endpoint should be reserved for Global Admins or removed from Tenant API.
        return res.status(403).json({ message: "La création de produits est réservée aux SuperAdmins. Veuillez utiliser le catalogue global." });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getSerializedPacks = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.query.productId as string;
        const packs = pharmacyService.getSerializedPacks({ tenantId, productId });
        res.json(packs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getLooseUnits = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.query.productId as string;
        const serviceId = req.query.serviceId as string;
        const units = pharmacyService.getLooseUnits(tenantId, productId, serviceId);
        res.json(units);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getLocations = (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const serviceId = req.query.serviceId as string;
        const scope = req.query.scope as 'PHARMACY' | 'SERVICE';
        
        if (serviceId) {
             const userServices = user?.service_ids || [];
             // Allow if: Assigned to Service OR Tenant SuperAdmin OR Struct Admin (Settings Manager)
             const canAccess = 
                userServices.includes(serviceId) || 
                user?.user_type === 'TENANT_SUPERADMIN' ||
                user?.role_code === 'ADMIN_STRUCT' ||
                user?.role_id === 'role_admin_struct';

             if (!canAccess) {
                  return res.status(403).json({ message: "Accès refusé" });
             }
        }

        const locations = pharmacyService.getLocations(tenantId, serviceId, scope);
        res.json(locations);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createLocation = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const location = pharmacyService.addLocation({ ...req.body, tenantId });
        res.status(201).json(location);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateLocation = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const location = { ...req.body, tenantId };
        if (req.params.id) location.id = req.params.id;
        const updated = pharmacyService.updateLocation(location);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteLocation = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        pharmacyService.deleteLocation(tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Suppliers
export const getSuppliers = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const suppliers = pharmacyService.getSuppliers(tenantId);
        res.json(suppliers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createSupplier = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const supplier = pharmacyService.addSupplier({ ...req.body, tenantId });
        res.status(201).json(supplier);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateSupplier = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const supplier = { ...req.body, tenantId };
        if (req.params.id) supplier.id = req.params.id;
        const updated = pharmacyService.updateSupplier(supplier);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteSupplier = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        pharmacyService.deleteSupplier(tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateProduct = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.params.id;
        
        // Tenant can only update CONFIG (Enabled status, Prices, Suppliers)
        // Extract relevant fields
        const config = {
             enabled: req.body.isEnabled, // UI should send 'isEnabled'
             suppliers: req.body.suppliers || []
        };
        
        const updated = pharmacyService.updateProductConfig(tenantId, productId, config);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Partners
export const getPartners = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partners = pharmacyService.getPartners(tenantId);
        res.json(partners);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPartner = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partner = pharmacyService.addPartner({ ...req.body, tenantId });
        res.status(201).json(partner);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePartner = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partner = { ...req.body, tenantId };
        if (req.params.id) partner.id = req.params.id;
        const updated = pharmacyService.updatePartner(partner);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deletePartner = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        pharmacyService.deletePartner(tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// StockOut
export const getStockOutSafety = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const history = pharmacyService.getStockOutHistory(tenantId);
        res.json(history);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Procurement
export const getPurchaseOrders = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const pos = pharmacyService.getPurchaseOrders(tenantId);
        res.json(pos);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPurchaseOrder = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const po = pharmacyService.createPurchaseOrder({ ...req.body, tenantId });
        res.status(201).json(po);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getDeliveryNotes = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const notes = pharmacyService.getDeliveryNotes(tenantId);
        res.json(notes);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createDeliveryNote = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const note = pharmacyService.createDeliveryNote({ ...req.body, tenantId });
        res.status(201).json(note);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const processQuarantine = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const result = pharmacyService.processQuarantine({ ...req.body, tenantId });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Replenishments
export const getReplenishmentRequests = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const requests = pharmacyService.getReplenishmentRequests(tenantId);
        res.json(requests);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createReplenishmentRequest = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const request = pharmacyService.createReplenishmentRequest({ ...req.body, tenantId });
        res.status(201).json(request);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateReplenishmentRequestStatus = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { id } = req.params;
        const { status, processedRequest } = req.body; 
        const updated = pharmacyService.updateReplenishmentRequestStatus(tenantId, id, status, processedRequest);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const dispenseFromServiceStock = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const result = pharmacyService.dispenseFromServiceStock({ ...req.body, tenantId });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// --- RETURNS ---

export const createReturnRequest = (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const { admissionId, items, destination, targetLocationId, serviceId } = req.body;
        
        // Manual construction of Request & Containers to avoid ReturnService bloat
        // Or implement simple constructor here
        
        const requestId = `REQ-${Date.now()}`;
        const newItems: any[] = [];
        
        // Create Containers from items
        (items as any[]).forEach(item => {
             const containerId = `RET-CONT-${Date.now()}-${Math.random()}`;
             
             // Construct Container (Simplified)
             const container: Container = {
                 id: containerId,
                 type: item.serialNumber ? ContainerType.RETURNED_BOX : ContainerType.RETURNED_UNIT_BATCH,
                 productId: item.productId,
                 serialNumber: item.serialNumber,
                 lotNumber: item.batchNumber,
                 expiryDate: item.expiryDate,
                 originLocation: item.sourceType === 'PHARMACY' ? 'CENTRAL_PHARMACY' : 'SERVICE_STOCK',
                 currentLocation: 'TRANSIT',
                 unitsPerPack: 1, // Need to fetch product def? Simplification for now
                 availableBoxes: 1,
                 availableUnits: item.quantity,
                 state: ContainerState.RETURNED_PENDING_QA,
                 history: [],
                 createdAt: new Date(),
                 updatedAt: new Date(), 
                 // Missing props? defined in model
             } as any; // Type casting for brevity
             
             pharmacyService.addContainer(tenantId, container);
             
             newItems.push({
                 containerId: containerId,
                 quantity: item.quantity,
                 type: container.type,
                 condition: item.condition,
                 dispensationId: item.dispensationId
             });
        });

        const returnRequest: ReturnRequest = {
            id: requestId,
            admissionId,
            serviceId,
            items: newItems,
            destination,
            targetLocationId,
            status: ReturnRequestStatus.PENDING_QA,
            createdAt: new Date(),
            createdBy: user?.id || 'system'
        };

        const created = pharmacyService.createReturnRequest(tenantId, returnRequest);
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating return request:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getReturns = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const returns = pharmacyService.getReturnRequests(tenantId);
        // Enrichment? 
        // For now return raw, frontend might need IDs replaced by Names.
        // If critical, we should fetch EMR data here.
        res.json(returns);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const processReturn = (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const { id } = req.params;
        const { decision } = req.body;
        pharmacyService.processReturnDecision(tenantId, id, decision, user?.id || 'system');
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const processReturnSplit = (req: Request, res: Response) => {
    // Not implemented in Service yet properly, skipping for brevity or implement if needed
    res.status(501).json({ message: 'Not implemented' });
};

export const getReturnsByAdmission = (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const { admissionId } = req.params;
        const returns = pharmacyService.getReturnRequests(tenantId, admissionId);
        res.json(returns);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
