import { Router } from 'express';
import { createReport, getReportById, listReportsByPatient, updateReport, createTest, createResult, linkDocument, mergeDocuments, reorderDocuments, autosaveResults, validateReport, correctResult } from '../controllers/patientLabReportController';

const router = Router();

router.post('/', createReport);
router.get('/patient/:patientId', listReportsByPatient);
router.get('/:id', getReportById);
router.put('/:id', updateReport);

// Incremental appending
router.post('/:id/tests', createTest);
router.post('/tests/:testId/results', createResult);
router.post('/:id/documents', linkDocument);
router.post('/:id/merge', mergeDocuments);
router.put('/:id/documents/reorder', reorderDocuments);

// Lab Results Engine Endpoints
router.post('/:reportId/results/autosave', autosaveResults);
router.post('/:reportId/validate', validateReport);
router.post('/results/:resultId/correct', correctResult);
export default router;
