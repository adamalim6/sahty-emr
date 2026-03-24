import { Router } from 'express';
import { attachDocumentToReport, listDocumentsForReport, detachDocumentFromReport } from '../controllers/labDocumentLinkController';

const router = Router();

// Endpoint to attach a document to a lab report
router.post('/', attachDocumentToReport);

// Endpoint to list all documents for a given lab report
router.get('/:patientLabReportId/documents', listDocumentsForReport);

// Endpoint to detach a document from a lab report
router.delete('/:patientLabReportId/documents/:documentId', detachDocumentFromReport);

export default router;
