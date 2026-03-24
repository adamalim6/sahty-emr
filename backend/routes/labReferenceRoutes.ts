import { Router } from 'express';
import { searchAnalyteContexts, getAnalyteContextsByActs, searchLabAnalytesOrActs } from '../controllers/labReferenceController';

const router = Router();

router.get('/lab-analyte-contexts/search', searchAnalyteContexts);
router.post('/lab-analyte-contexts/by-acts', getAnalyteContextsByActs);
router.get('/lab-search', searchLabAnalytesOrActs);

export default router;
