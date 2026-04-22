import { Router } from 'express';
import { StaffController } from './staff.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import { submissionUpload } from '../../middleware/upload';
import { reviewSubmissionSchema, gradeSubmissionSchema, resolveReEvalSchema } from './staff.validator';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate, requireRoles(UserRole.STAFF, UserRole.ADMIN));

// ── Students ─────────────────────────────────────────────────────────
router.get('/my-students', authorize('staff_student_mappings', 'read'), StaffController.getAssignedStudents);

// ── Assignments ───────────────────────────────────────────────────────
router.post('/assignments', authorize('assignments', 'create'), submissionUpload.single('file'), StaffController.createAssignment);
router.get('/assignments', authorize('assignments', 'read'), StaffController.getAssignments);

// ── Submissions ───────────────────────────────────────────────────────
router.get('/assignments/:assignmentId/submissions', authorize('submissions', 'read'), StaffController.getSubmissions);
router.post('/submissions/:submissionId/review', authorize('submissions', 'review'), validateRequest(reviewSubmissionSchema), StaffController.reviewSubmission);
router.post('/submissions/:submissionId/grade', authorize('grades', 'grade'), validateRequest(gradeSubmissionSchema), StaffController.gradeSubmission);

// ── Re-Evaluation ─────────────────────────────────────────────────────
router.get('/re-evaluations', authorize('re_evaluations', 'read'), StaffController.getReEvaluationRequests);
router.patch('/re-evaluations/:id', authorize('re_evaluations', 'update'), validateRequest(resolveReEvalSchema), StaffController.resolveReEvaluation);

export default router;
