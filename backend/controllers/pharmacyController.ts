
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


export const getInventory = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const serviceId = req.query.serviceId as string;
        const scopeParam = req.query.scope as string;
        
        // Determine scope from explicit parameter or infer from serviceId
        // If scope is explicitly passed, use it; otherwise infer from serviceId presence
        let scope: 'PHARMACY' | 'SERVICE';
        if (scopeParam === 'SERVICE' || scopeParam === 'PHARMACY') {
            scope = scopeParam;
        } else {
            scope = serviceId ? 'SERVICE' : 'PHARMACY';
        }
        
        console.log(`[getInventory Controller] tenant=${tenantId} scope=${scope} serviceId=${serviceId} user=${user?.username}`);
        
        // SERVICE scope requires serviceId
        if (scope === 'SERVICE' && !serviceId) {
            console.log(`[getInventory Controller] ERROR: SERVICE scope requires serviceId`);
            return res.status(400).json({ message: "SERVICE scope requires serviceId parameter" });
        }
        
        // Authorization check for SERVICE scope
        if (scope === 'SERVICE' && serviceId) {
            const userServices = user?.service_ids || [];
            const serviceIdLower = serviceId.toLowerCase().trim();
            
            console.log(`[getInventory Controller] AUTH CHECK: user_type=${user?.user_type} service_ids=${JSON.stringify(userServices)} serviceId=${serviceId}`);
            
            // Allow TENANT_SUPERADMIN/TENANT_ADMIN, or if user is assigned to this service
            const isAdmin = user?.user_type === 'TENANT_SUPERADMIN' || user?.user_type === 'TENANT_ADMIN';
            
            // Normalize UUID comparison - handle both array and potential stringified formats
            let hasServiceAccess = false;
            if (Array.isArray(userServices)) {
                hasServiceAccess = userServices.some((sid: any) => {
                    const sidStr = String(sid).toLowerCase().trim();
                    return sidStr === serviceIdLower;
                });
            }
            
            console.log(`[getInventory Controller] AUTH CHECK: isAdmin=${isAdmin} hasServiceAccess=${hasServiceAccess}`);
            
            if (!hasServiceAccess && !isAdmin) {
                console.log(`[getInventory Controller] 403: User not authorized for service ${serviceId}`);
                return res.status(403).json({ message: "Accès refusé : Vous n'êtes pas affecté à ce service." });
            }
            console.log(`[getInventory Controller] AUTH PASSED`);
        }
        
        // Pass scope and serviceId to service - filtering is done at the SQL level
        const inventory = await pharmacyService.getInventory(tenantId, scope, serviceId);
        console.log(`[getInventory Controller] Returning ${inventory.length} items for scope=${scope}`);
        
        res.json(inventory);
    } catch (error: any) {
        console.error(`[getInventory Controller] ERROR:`, error.message);
        res.status(500).json({ message: error.message });
    }
};

export const getCatalog = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const q = (req.query.q as string) || '';
        const status = (req.query.status as 'ALL' | 'ACTIVE' | 'INACTIVE') || 'ALL';

        if (req.query.page || req.query.limit) {
            const result = await pharmacyService.getCatalogPaginated(tenantId, page, limit, q, status);
            return res.json(result);
        }

        const catalog = await pharmacyService.getCatalog(tenantId);
        res.json(catalog);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createProduct = (req: Request, res: Response) => {
    try {
        return res.status(403).json({ message: "La création de produits est réservée aux SuperAdmins. Veuillez utiliser le catalogue global." });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getSerializedPacks = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.query.productId as string;
        const packs = await pharmacyService.getSerializedPacks({ tenantId, productId });
        res.json(packs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getLooseUnits = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.query.productId as string;
        const serviceId = req.query.serviceId as string;
        const units = await pharmacyService.getLooseUnits(tenantId, productId, serviceId);
        res.json(units);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getLocations = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const serviceId = req.query.serviceId as string;
        const scope = req.query.scope as 'PHARMACY' | 'SERVICE';
        
        if (serviceId) {
             const userServices = user?.service_ids || [];
             const serviceIdLower = serviceId.toLowerCase().trim();
             console.log(`[getLocations] Auth Check: User=${user?.username}, Type=${user?.user_type}, Services=${JSON.stringify(userServices)} ServiceId=${serviceId}`);

             // Check if user is an admin type
             const isAdmin = user?.user_type === 'TENANT_SUPERADMIN' || 
                            user?.user_type === 'TENANT_ADMIN' ||
                            user?.role_code === 'ADMIN_STRUCT' ||
                            user?.role_id === 'role_admin_struct';

             // Normalize UUID comparison for service_ids
             let hasServiceAccess = false;
             if (Array.isArray(userServices)) {
                 hasServiceAccess = userServices.some((sid: any) => {
                     const sidStr = String(sid).toLowerCase().trim();
                     return sidStr === serviceIdLower;
                 });
             }
             
             console.log(`[getLocations] Auth: isAdmin=${isAdmin} hasServiceAccess=${hasServiceAccess}`);

             if (!hasServiceAccess && !isAdmin) {
                  return res.status(403).json({ message: `Accès refusé pour service ${serviceId}.` });
             }
        }

        const locations = await pharmacyService.getLocations(tenantId, serviceId, scope);
        res.json(locations);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Context-Based Location Access
 * 
 * Contexts:
 * - CONFIG_LOCATIONS: Pharmacy Emplacements config page (PHARMACY + PHYSICAL only)
 * - STOCK_PHARMACY: Stock Pharma page (PHARMACY + PHYSICAL)
 * - STOCK_SERVICE: Stock Service page (SERVICE + PHYSICAL + specific service)
 * - SYSTEM_LOCATIONS: All locations including VIRTUAL (for engine/transfers/returns)
 */
export const getLocationsByContext = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        const context = req.query.context as 'CONFIG_LOCATIONS' | 'STOCK_PHARMACY' | 'STOCK_SERVICE' | 'SYSTEM_LOCATIONS';
        const serviceId = req.query.serviceId as string;
        
        if (!context) {
            return res.status(400).json({ message: 'Context parameter is required' });
        }

        // Validate context value
        const validContexts = ['CONFIG_LOCATIONS', 'STOCK_PHARMACY', 'STOCK_SERVICE', 'SYSTEM_LOCATIONS'];
        if (!validContexts.includes(context)) {
            return res.status(400).json({ message: `Invalid context: ${context}` });
        }

        // Service access check for STOCK_SERVICE context
        if (context === 'STOCK_SERVICE' && serviceId) {
            const userServices = user?.service_ids || [];
            const serviceIdLower = serviceId.toLowerCase().trim();
            
            const isAdmin = user?.user_type === 'TENANT_SUPERADMIN' || 
                           user?.user_type === 'TENANT_ADMIN' ||
                           user?.role_code === 'ADMIN_STRUCT';

            let hasServiceAccess = false;
            if (Array.isArray(userServices)) {
                hasServiceAccess = userServices.some((sid: any) => 
                    String(sid).toLowerCase().trim() === serviceIdLower
                );
            }
            
            if (!hasServiceAccess && !isAdmin) {
                return res.status(403).json({ message: `Accès refusé pour service ${serviceId}.` });
            }
        }

        const locations = await pharmacyService.getLocationsByContext(context, tenantId, serviceId);
        res.json(locations);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createLocation = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const location = await pharmacyService.addLocation({ ...req.body, tenantId });
        res.status(201).json(location);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateLocation = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const location = { ...req.body, tenantId };
        if (req.params.id) location.id = req.params.id;
        const updated = await pharmacyService.updateLocation(location);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteLocation = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await pharmacyService.deleteLocation(tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Suppliers
export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const suppliers = await pharmacyService.getSuppliers(tenantId);
        res.json(suppliers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const supplier = await pharmacyService.addSupplier({ ...req.body, tenantId });
        res.status(201).json(supplier);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const supplier = { ...req.body, tenantId };
        if (req.params.id) supplier.id = req.params.id;
        const updated = await pharmacyService.updateSupplier(supplier);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await pharmacyService.deleteSupplier(tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

    export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const productId = req.params.id;
        const { user } = getContext(req);
        const reason = req.body.reason; // Ensure this is passed from frontend

        const config = {
             id: productId, // Important: Service expects id in config
             enabled: req.body.isEnabled, // Frontend sends isEnabled
             isEnabled: req.body.isEnabled, // Support both just in case
             minStock: req.body.minStock,
             maxStock: req.body.maxStock,
             securityStock: req.body.securityStock,
             suppliers: req.body.suppliers || [],
             reason: reason, // Pass reason to service
             userId: user?.username || 'Unknown' // Pass userId for history
        };
        
        // Pass complete config to service
        const updated = await pharmacyService.updateProductConfig(tenantId, config);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// Partners (Keep as sync for now as stub is sync)
export const getPartners = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partners = await pharmacyService.getPartners(tenantId);
        res.json(partners);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPartner = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partner = await pharmacyService.addPartner({ ...req.body, tenantId });
        res.status(201).json(partner);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePartner = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const partner = { ...req.body, tenantId };
        if (req.params.id) partner.id = req.params.id;
        const updated = await pharmacyService.updatePartner(partner);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deletePartner = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await pharmacyService.deletePartner(tenantId, req.params.id);
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
export const getPurchaseOrders = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const pos = await pharmacyService.getPurchaseOrders(tenantId);
        res.json(pos);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

    export const createPurchaseOrder = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const userId = (req as any).user?.username || (req as any).user?.id || 'Système';
        const po = await pharmacyService.createPurchaseOrder({ ...req.body, tenantId, userId });
        res.status(201).json(po);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getDeliveryNotes = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const notes = await pharmacyService.getDeliveryNotes(tenantId);
        res.json(notes);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createDeliveryNote = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const userId = (req as any).user?.username || (req as any).user?.id || 'Système';
        const note = await pharmacyService.createDeliveryNote({ ...req.body, tenantId, userId });
        res.status(201).json(note);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const processQuarantine = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const result = await pharmacyService.processQuarantine({ ...req.body, tenantId });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// NOTE: Legacy replenishment controller functions removed (getReplenishmentRequests, createReplenishmentRequest, updateReplenishmentRequestStatus)
// Use stock-transfers routes instead

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
    // Keep sync for now as stub is sync
    try {
        const { tenantId, user } = getContext(req);
        const { admissionId, items, destination, targetLocationId, serviceId } = req.body;
        
        const requestId = `REQ-${Date.now()}`;
        const newItems: any[] = [];
        
        const returnRequest: ReturnRequest = {
            id: requestId,
            admissionId,
            serviceId,
            items: [],
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

export const resetDB = async (req: Request, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await pharmacyService.resetDB(tenantId);
        res.json({ message: 'Database reset for tenant.' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
