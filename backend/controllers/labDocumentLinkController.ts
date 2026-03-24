import { Request, Response } from 'express';
import { getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';
import { LabDocumentLinkService } from '../services/labDocumentLinkService';
import { LabDocumentLinkRepository } from '../repositories/labDocumentLinkRepository';
import { PatientDocumentService } from '../services/patientDocumentService';
import { PatientDocumentRepository } from '../repositories/patientDocumentRepository';
import { MinioDocumentStorageProvider } from '../services/MinioDocumentStorageProvider';

// Instantiation - in a real app this might be injected
const storageProvider = new MinioDocumentStorageProvider();
const documentRepo = new PatientDocumentRepository();
const documentService = new PatientDocumentService(documentRepo, storageProvider);

const linkRepo = new LabDocumentLinkRepository();
const linkService = new LabDocumentLinkService(linkRepo, documentService);

export const attachDocumentToReport = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const finalTenantId = tenantId;
            if (!finalTenantId) {
                return res.status(401).json({ error: 'Tenant context missing' });
            }
            const dto = req.body;
            // The dto should have patient_lab_report_id and document_id
            const link = await linkService.attachExistingDocumentToReport(client, dto, finalTenantId);
            res.status(201).json(link);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error attaching document to lab report:', e);
        res.status(500).json({ error: e.message });
    }
};

export const listDocumentsForReport = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const { patientLabReportId } = req.params;
            const links = await linkService.listDocumentsForReport(client, patientLabReportId);
            res.status(200).json(links);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error listing documents for lab report:', e);
        res.status(500).json({ error: e.message });
    }
};

export const detachDocumentFromReport = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const { patientLabReportId, documentId } = req.params;
            const success = await linkService.detachDocumentFromReport(client, patientLabReportId, documentId);
            if (!success) {
                return res.status(404).json({ error: 'Link not found or already detached' });
            }
            res.status(200).json({ success: true });
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error detaching document from lab report:', e);
        res.status(500).json({ error: e.message });
    }
};
