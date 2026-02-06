
import { Request, Response } from 'express';
import { stockReturnService } from '../services/stockReturnService';

export const createReturn = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const userId = (req as any).user?.userId || (req as any).user?.id;
        const { serviceId, reservationId } = req.body;

        if (!serviceId || !reservationId) {
            return res.status(400).json({ error: 'Missing serviceId or reservationId' });
        }

        if (!userId) {
             return res.status(401).json({ error: 'User ID missing from token' });
        }

        const returnId = await stockReturnService.createReturn(
            tenantId, 
            userId, 
            serviceId, 
            reservationId
        );
        res.status(201).json({ id: returnId });
    } catch (error: any) {
        console.error('[StockReturn] Create Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getReturns = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const { serviceId, status } = req.query;

        const returns = await stockReturnService.getReturns(tenantId, serviceId as string, status as string);
        res.json(returns);
    } catch (error: any) {
        console.error('[StockReturn] Get Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getReturnDetails = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const { id } = req.params;

        const details = await stockReturnService.getReturnDetails(tenantId, id);
        if (!details) return res.status(404).json({ error: 'Return not found' });
        
        res.json(details);
    } catch (error: any) {
        console.error('[StockReturn] Details Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getReceptions = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const { id } = req.params; // returnId

        const receptions = await stockReturnService.getReceptionsByReturnId(tenantId, id);
        res.json(receptions);
    } catch (error: any) {
        console.error('[StockReturn] Receptions Error:', error);
        res.status(500).json({ error: error.message });
    }
};


export const getReceptionDetails = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const { id } = req.params; 

        const reception = await stockReturnService.getReceptionDetails(tenantId, id);
        if (!reception) return res.status(404).json({ error: 'Reception not found' });
        
        res.json(reception);
    } catch (error: any) {
        console.error('[StockReturn] Reception Details Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createReception = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const userId = (req as any).user?.userId || (req as any).user?.id;
        const { returnId, lines } = req.body;

        if (!returnId || !lines || !Array.isArray(lines)) {
            return res.status(400).json({ error: 'Missing returnId or lines array' });
        }

        const receptionId = await stockReturnService.createReception(
            tenantId,
            userId,
            returnId,
            lines
        );

        res.status(201).json({ id: receptionId });
    } catch (error: any) {
        console.error('[StockReturn] Reception Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createReturnDecision = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const userId = (req as any).user?.userId || (req as any).user?.id;
        const { id } = req.params; // receptionId
        const { decisions } = req.body;

        if (!decisions || !Array.isArray(decisions)) {
            return res.status(400).json({ error: 'Missing decisions array' });
        }

        const decisionId = await stockReturnService.createReturnDecision(
            tenantId,
            id,
            userId,
            decisions
        );

        res.status(201).json({ id: decisionId });
    } catch (error: any) {
        console.error('[StockReturn] Decision Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getDecisions = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.client_id || (req as any).user?.tenantId;
        const { id } = req.params; // receptionId

        const decisions = await stockReturnService.getDecisionsByReceptionId(tenantId, id);
        res.json(decisions);
    } catch (error: any) {
        console.error('[StockReturn] Get Decisions Error:', error);
        res.status(500).json({ error: error.message });
    }
};
