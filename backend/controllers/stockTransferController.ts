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
            const demandId = await stockTransferService.createDemand(tenantId, req.body);
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

            const userId = (req as any).user?.id || 'SYSTEM'; 
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
    }
};
