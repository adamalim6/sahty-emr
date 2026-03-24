import { Request, Response } from 'express';
import { getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';
import { LabReferenceService } from '../services/labReferenceService';
import { LabReferenceRepository } from '../repositories/labReferenceRepository';

const referenceRepo = new LabReferenceRepository();
const referenceService = new LabReferenceService(referenceRepo);

export const searchAnalyteContexts = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);
        
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ message: 'Query parameter "q" is required' });
        }

        const results = await referenceService.searchAnalyteContexts(pool, query);
        res.status(200).json(results);
    } catch (error: any) {
        console.error('Error searching analyte contexts:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const getAnalyteContextsByActs = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);

        const { globalActIds } = req.body;
        if (!globalActIds || !Array.isArray(globalActIds)) {
            return res.status(400).json({ message: 'globalActIds array is required in body' });
        }

        const results = await referenceService.getAnalyteContextsByGlobalActs(pool, globalActIds);
        res.status(200).json(results);
    } catch (error: any) {
        console.error('Error fetching analyte contexts by acts:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const searchLabAnalytesOrActs = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ message: 'Query parameter "q" is required' });
        }

        const results = await referenceService.searchLabAnalytesOrActs(pool, query);
        res.status(200).json(results);
    } catch (error: any) {
        console.error('Error in searchLabAnalytesOrActs:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};
