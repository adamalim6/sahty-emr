import { Router } from 'express';
import multer from 'multer';
import { createDocumentMetadata, getDocument, listPatientDocuments, uploadDocument, streamDocument } from '../controllers/patientDocumentController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Endpoint to upload a document (file + metadata)
router.post('/upload', authenticateToken, upload.single('file'), uploadDocument);

// Endpoint to stream a document natively
router.get('/:id/stream', authenticateToken, streamDocument);

// Endpoint to create a generic patient document metadata record manually
router.post('/', createDocumentMetadata);

// Endpoint to fetch metadata for a specific document
router.get('/:id', getDocument);

// Endpoint to list documents for a given patient
router.get('/patient/:tenantPatientId', listPatientDocuments);

export default router;
