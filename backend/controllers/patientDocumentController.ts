import { Request, Response } from 'express';
import { getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';
import { PatientDocumentService } from '../services/patientDocumentService';
import { PatientDocumentRepository } from '../repositories/patientDocumentRepository';
import { MinioDocumentStorageProvider } from '../services/MinioDocumentStorageProvider';
import { convertWebpToPdf } from '../utils/convertWebpToPdf';

const storageProvider = new MinioDocumentStorageProvider();
const repository = new PatientDocumentRepository();
const documentService = new PatientDocumentService(repository, storageProvider);

export const uploadDocument = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            // Check for file
            const file = req.file;
            let buffer: Buffer;
            let originalName: string;
            let mimeType: string;

            if (file) {
                buffer = file.buffer;
                originalName = file.originalname;
                mimeType = file.mimetype;
            } else if (req.body && Buffer.isBuffer(req.body)) {
                // If accepting raw buffer directly
                buffer = req.body;
                originalName = req.query.filename as string || 'upload.bin';
                mimeType = req.headers['content-type'] || 'application/octet-stream';
            } else {
                return res.status(400).json({ error: 'No file provided' });
            }

            let originalMimeType = undefined;
            if (mimeType === 'image/webp') {
                console.log('Converted WEBP → PDF for document upload');
                originalMimeType = mimeType;
                buffer = await convertWebpToPdf(buffer);
                mimeType = 'application/pdf';
                originalName = originalName.replace(/\.webp$/i, '.pdf');
            }

            const { patientId, documentType } = req.body;
            if (!patientId || !documentType) {
                return res.status(400).json({ error: 'patientId and documentType are required fields' });
            }

            const uploadedByUserId = (req as any).user?.userId || req.body.uploaded_by_user_id;

            const finalTenantId = tenantId;
            if (!finalTenantId) {
                return res.status(401).json({ error: 'Tenant context missing' });
            }

            const docId = await documentService.createDocumentFromBuffer(client, {
                tenantId: finalTenantId,
                buffer,
                originalName,
                mimeType,
                originalMimeType,
                patientId,
                documentType,
                uploadedByUserId
            });

            res.status(201).json({ id: docId });
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error uploading document:', e);
        res.status(500).json({ error: e.message });
    }
};

export const streamDocument = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const finalTenantId = tenantId;
            const { id } = req.params;
            const { stream, mimeType } = await documentService.getDocumentStream(client, id, finalTenantId);
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', 'inline');
            stream.pipe(res);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error streaming document:', e);
        if (e.message === 'Document not found' || e.message === 'Document has no storage path') {
            res.status(404).json({ error: e.message });
        } else {
            res.status(500).json({ error: e.message });
        }
    }
};

export const createDocumentMetadata = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const finalTenantId = tenantId;
            const dto = req.body;
            dto.tenant_id = dto.tenant_id || finalTenantId;
            const doc = await documentService.createDocumentMetadata(client, dto);
            res.status(201).json(doc);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error creating document:', e);
        res.status(500).json({ error: e.message });
    }
};

export const getDocument = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const finalTenantId = tenantId;
            const { id } = req.params;
            const doc = await documentService.getDocumentById(client, id, finalTenantId);
            if (!doc) {
                return res.status(404).json({ error: 'Document not found' });
            }
            res.status(200).json(doc);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error getting document:', e);
        res.status(500).json({ error: e.message });
    }
};

export const listPatientDocuments = async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'Tenant ID missing from authenticated user' });
    console.log("User:", (req as any).user);
    console.log("Tenant ID:", tenantId);
    const pool = getTenantPool(tenantId);

    try {
        const client = await pool.connect();
        try {
            const finalTenantId = tenantId;
            const { tenantPatientId } = req.params;
            const { documentType } = req.query;
            const docs = await documentService.listPatientDocuments(client, finalTenantId, tenantPatientId, documentType as string);
            res.status(200).json(docs);
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error('Error listing patient documents:', e);
        res.status(500).json({ error: e.message });
    }
};
