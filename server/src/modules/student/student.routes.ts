import { Router } from 'express';
import { StudentController } from './student.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import { submissionUpload } from '../../middleware/upload';
import { createSubmissionSchema, reEvaluationSchema } from './student.validator';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRoles(UserRole.STUDENT, UserRole.ADMIN));

// ── Staff ────────────────────────────────────────────────────────────
router.get('/my-staff', authorize('staff_student_mappings', 'read'), StudentController.getMyStaff);
 
// ── Assignments ───────────────────────────────────────────────────────
router.get('/assignments', authorize('assignments', 'read'), StudentController.getMyAssignments);

// ── Submissions ───────────────────────────────────────────────────────
router.post('/submit', authorize('submissions', 'submit'), submissionUpload.single('file'), validateRequest(createSubmissionSchema), StudentController.submitAssignment);
router.get('/submissions', authorize('submissions', 'read'), StudentController.getMySubmissions);

// ── Grades & Feedback ─────────────────────────────────────────────────
router.get('/grades', authorize('grades', 'read'), StudentController.getMyGrades);

// ── Re-Evaluation ─────────────────────────────────────────────────────
router.post('/re-evaluate', authorize('re_evaluations', 'create'), validateRequest(reEvaluationSchema), StudentController.requestReEvaluation);
router.get('/re-evaluations', authorize('re_evaluations', 'read'), StudentController.getMyReEvaluations);

export default router;
