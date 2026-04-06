import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validate';
import { csvUpload as csvMulter } from '../../middleware/upload';
import { assignStaffSchema, paginationQuerySchema } from './admin.validator';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// ── Academic Cycles ────────────────────────────────────────────────────
router.post('/cycles', authorize('academic_cycles', 'create'), AdminController.createCycle);
router.get('/cycles', authorize('academic_cycles', 'read'), validateRequest(paginationQuerySchema), AdminController.getCycles);
router.patch('/cycles/:id', authorize('academic_cycles', 'update'), AdminController.updateCycle);
router.delete('/cycles/:id', authorize('academic_cycles', 'delete'), AdminController.deleteCycle);

// ── Users ────────────────────────────────────────────────────────────
router.get('/users', authorize('users', 'read'), validateRequest(paginationQuerySchema), AdminController.getUsers);
router.patch('/users/:id/deactivate', authorize('users', 'update'), AdminController.deactivateUser);

// ── Staff-Student Assignments ─────────────────────────────────────────
router.post('/assign-students', authorize('staff_student_mappings', 'assign'), validateRequest(assignStaffSchema), AdminController.assignStudents);
router.get('/staff/:staffId/students', authorize('staff_student_mappings', 'read'), AdminController.getStaffStudents);

// ── Bulk Upload ───────────────────────────────────────────────────────
router.post('/bulk-upload', authorize('bulk_upload', 'create'), csvMulter.single('file'), AdminController.bulkUploadStudents);

// ── System Stats ──────────────────────────────────────────────────────
router.get('/stats', authorize('audit_logs', 'read'), AdminController.getSystemStats);

// ── Audit Logs ────────────────────────────────────────────────────────
router.get('/audit-logs', authorize('audit_logs', 'read'), validateRequest(paginationQuerySchema), AdminController.getAuditLogs);

export default router;
