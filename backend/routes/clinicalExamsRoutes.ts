import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { 
    getClinicalExams, 
    createClinicalExam, 
    updateClinicalExam, 
    invalidateClinicalExam 
} from '../controllers/clinicalExamsController';

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);

// GET /api/patients/:patientId/clinical-exams
router.get('/', getClinicalExams);

// POST /api/patients/:patientId/clinical-exams
router.post('/', createClinicalExam);

// PUT /api/patients/:patientId/clinical-exams/:examId
router.put('/:examId', updateClinicalExam);

// PATCH /api/patients/:patientId/clinical-exams/:examId/error
router.patch('/:examId/error', invalidateClinicalExam);

export default router;
