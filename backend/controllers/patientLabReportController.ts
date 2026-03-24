import { Request, Response } from 'express';
import { getTenantPool } from '../db/tenantPg';
import { Pool } from 'pg';
import { PatientLabReportService } from '../services/patientLabReportService';
import { PatientLabReportRepository } from '../repositories/patientLabReportRepository';
import { PatientLabReportTestRepository } from '../repositories/patientLabReportTestRepository';
import { PatientLabResultRepository } from '../repositories/patientLabResultRepository';
import { PatientDocumentService } from '../services/patientDocumentService';
import { PatientDocumentRepository } from '../repositories/patientDocumentRepository';
import { MinioDocumentStorageProvider } from '../services/MinioDocumentStorageProvider';

const reportRepo = new PatientLabReportRepository();
const testRepo = new PatientLabReportTestRepository();
const resultRepo = new PatientLabResultRepository();
const reportService = new PatientLabReportService(reportRepo, testRepo, resultRepo);

const docStorage = new MinioDocumentStorageProvider();
const docRepo = new PatientDocumentRepository();
const docService = new PatientDocumentService(docRepo, docStorage);

export const createReport = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);

        const reportPayload = req.body;
        reportPayload.uploaded_by_user_id = (req as any).user?.userId || req.body.uploaded_by_user_id;

        const report = await reportService.createFullLabReport(pool, tenantId, reportPayload);
        res.status(201).json(report);
    } catch (error: any) {
        console.error('Error creating lab report:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const getReportById = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);
        const { id } = req.params;

        const report = await reportService.getReportById(pool, tenantId, id);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.status(200).json(report);
    } catch (error: any) {
        console.error('Error fetching lab report:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const listReportsByPatient = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);
        const { patientId } = req.params;

        const reports = await reportService.listReportsByPatient(pool, tenantId, patientId);
        res.status(200).json(reports);
    } catch (error: any) {
        console.error('Error listing lab reports:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const createTest = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        console.log("User:", (req as any).user);
        console.log("Tenant ID:", tenantId);
        const pool = getTenantPool(tenantId);
        const { id } = req.params;

        const testPayload = { ...req.body, patient_lab_report_id: id };
        const test = await reportService.addTestToReport(pool, tenantId, testPayload);
        res.status(201).json(test);
    } catch (error: any) {
        console.error('Error creating lab report test:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const createResult = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { testId } = req.params;

        const resultPayload = { ...req.body, patient_lab_report_test_id: testId };
        const result = await reportService.addResultToTest(pool, tenantId, resultPayload);
        res.status(201).json(result);
    } catch (error: any) {
        console.error('Error creating lab result:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const linkDocument = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { id } = req.params;
        const { document_id } = req.body;

        await pool.query(
            'INSERT INTO patient_lab_report_documents (patient_lab_report_id, document_id) VALUES ($1, $2)', 
            [id, document_id]
        );
        res.status(201).json({ success: true, document_id });
    } catch (error: any) {
        console.error('Error linking document:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const mergeDocuments = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { id } = req.params;
        const userId = (req as any).user?.userId || 'SYSTEM';

        const result = await reportService.mergeLabReportDocuments(pool, tenantId, id, userId, docService);
        res.status(200).json(result);
    } catch (error: any) {
        console.error('Error merging documents:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const reorderDocuments = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { id } = req.params;
        const { documentIds } = req.body;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let i = 0; i < documentIds.length; i++) {
                await client.query(`
                    UPDATE public.patient_lab_report_documents 
                    SET sort_order = $1 
                    WHERE patient_lab_report_id = $2 AND document_id = $3 AND derivation_type = 'ORIGINAL'
                `, [i, id, documentIds[i]]);
            }
            await client.query('COMMIT');
            res.status(200).json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error reordering documents:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const autosaveResults = async (req: Request, res: Response) => {
    try {
        console.log("AUTOSAVE CONTROLLER HIT", req.body);
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { reportId } = req.params;
        const rows = req.body; // payload should just be array or { rows: [] }, assuming req.body is array

        // Wait, from my implementation plan: "autosave endpoint ... receives ONLY changed rows". Usually array.
        const rowsPayload = Array.isArray(req.body) ? req.body : req.body.rows;
        const updatedRows = await reportService.autosaveResults(pool, tenantId, reportId, rowsPayload);
        res.status(200).json(updatedRows);
    } catch (error: any) {
        console.error('Error autosaving results:', error);
        res.status(error.message?.includes('Only DRAFT reports can be autosaved') ? 409 : 500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const updateReport = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);

        const { id } = req.params;
        const updated = await reportService.updateReportDetails(pool, tenantId, id, req.body);
        res.status(200).json(updated);
    } catch (error: any) {
        console.error('Error updating report:', error);
        res.status(403).json({ message: error.message || 'Server Error' });
    }
};

export const validateReport = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { reportId } = req.params;

        const report = await reportService.validateReport(pool, tenantId, reportId);
        res.status(200).json(report);
    } catch (error: any) {
        console.error('Error validating report:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

export const correctResult = async (req: Request, res: Response) => {
    try {
        const tenantId = (req as any).user?.tenant_id;
        if (!tenantId) throw new Error('Tenant ID missing from authenticated user');
        const pool = getTenantPool(tenantId);
        const { resultId } = req.params;
        const userId = (req as any).user?.userId || 'SYSTEM';

        const newRow = await reportService.correctResult(pool, tenantId, resultId, userId, req.body);
        res.status(201).json(newRow);
    } catch (error: any) {
        console.error('Error correcting result:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};
