import { Request, Response } from 'express';
import { stockTransferService } from '../services/stockTransferService';
import { pharmacyService } from '../services/pharmacyService';
import { getTenantId } from '../middleware/authMiddleware';

export const stockTransferController = {
    // --- CATALOG (Exposed for Requesters) ---
    async getCatalog(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const q = (req.query.q as string) || '';
            const status = (req.query.status as 'ALL' | 'ACTIVE' | 'INACTIVE') || 'ACTIVE'; // Default ACTIVE for requesters

            const result = await pharmacyService.getCatalogPaginated(tenantId, page, limit, q, status);
            res.json(result);
        } catch (error: any) {
            console.error('Error fetching catalog for demand:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // --- DEMANDS ---
    
    async createDemand(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const userId = (req as any).user?.userId;
            // Use authenticated user's ID instead of whatever is passed in body
            const demandData = { ...req.body, requested_by: userId };
            const demandId = await stockTransferService.createDemand(tenantId, demandData);
            res.status(201).json({ id: demandId });
        } catch (error: any) {
            console.error('Error creating demand:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async getDemands(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { serviceId } = req.query;
            const demands = await stockTransferService.getDemands(tenantId, serviceId as string);
            res.json(demands);
        } catch (error: any) {
            console.error('Error fetching demands:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async getDemandDetails(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { demandId } = req.params;
            const demand = await stockTransferService.getDemandDetails(tenantId, demandId);
            if (!demand) return res.status(404).json({ message: 'Demand not found' });
            res.json(demand);
        } catch (error: any) {
            console.error('Error fetching demand details:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async updateDemandStatus(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { demandId } = req.params;
            const { status } = req.body;
            await stockTransferService.updateDemandStatus(tenantId, demandId, status);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error updating demand status:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async claimDemand(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { demandId } = req.params;
            const userId = (req as any).user?.userId;
            console.log(`[ClaimDemand] Request: tenant=${tenantId}, demand=${demandId}, user=${userId}`);
            await stockTransferService.claimDemand(tenantId, demandId, userId);
            console.log(`[ClaimDemand] Success: demand=${demandId}`);
            res.json({ success: true });
        } catch (error: any) {
            console.error('[ClaimDemand] Error:', error.message, 'Code:', error.code, 'Stack:', error.stack?.split('\n')[0]);
            if (error.code === 'DEMAND_LOCKED') {
                return res.status(409).json({
                    error: error.message,
                    message: error.message,
                    claimedBy: error.details?.claimedBy,
                    claimedAt: error.details?.claimedAt
                });
            }
            res.status(500).json({ error: error.message, message: error.message });
        }
    },

    async releaseDemand(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { demandId } = req.params;
            const userId = (req as any).user?.userId;
            await stockTransferService.releaseDemandClaim(tenantId, demandId, userId);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error releasing demand claim:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // --- TRANSFERS ---

    async createTransfer(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const transferId = await stockTransferService.createTransferDraft(tenantId, req.body);
            res.status(201).json({ id: transferId });
        } catch (error: any) {
            console.error('Error creating transfer:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async getTransfer(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { transferId } = req.params;
            const transfer = await stockTransferService.getTransferDetails(tenantId, transferId);
            if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
            res.json(transfer);
        } catch (error: any) {
            console.error('Error fetching transfer:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async executeTransfer(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { transferId } = req.params;

            const userId = (req as any).user?.userId || 'SYSTEM'; 
            await stockTransferService.executeTransfer(tenantId, transferId, userId);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error executing transfer:', error);
            res.status(500).json({ message: error.message });
        }
    },

    async getTransferHistory(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { productId } = req.params;
            const history = await stockTransferService.getTransferHistory(tenantId, productId);
            res.json(history);
        } catch (error: any) {
            console.error('Error fetching transfer history:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // --- SERVICE LOCATIONS (for EMR users) ---
    async getServiceLocations(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const serviceId = req.query.serviceId as string;
            
            if (!serviceId) {
                return res.status(400).json({ message: 'serviceId is required' });
            }
            
            // Fetch locations from the locations table filtered by service_id
            const locations = await pharmacyService.getLocations(tenantId, serviceId, 'SERVICE');
            res.json(locations);
        } catch (error: any) {
            console.error('Error fetching service locations:', error);
            res.status(500).json({ message: error.message });
        }
    }
};
