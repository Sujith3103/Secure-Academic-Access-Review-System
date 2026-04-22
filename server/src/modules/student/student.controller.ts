import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { successResponse, createdResponse } from '../../core/response';
import { ConflictError, NotFoundError, BadRequestError } from '../../core/errors';
import { logAudit } from '../../shared/audit';
import { parsePagination, buildPaginationMeta } from '../../shared/pagination';
import { getOrSet } from '../../shared/cache';
import { REDIS_KEYS, CACHE_TTL } from '../../config/redis';
import { AuditAction, SubmissionStatus, ReEvalStatus } from '@prisma/client';

export class StudentController {
    // ── View Assigned Staff ────────────────────────────────────────────
    static async getMyStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;

            const mappings = await prisma.staffStudentMapping.findMany({
                where: { studentId, deletedAt: null },
                include: {
                    staff: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
            });

            successResponse(res, mappings, 'Assigned staff');
        } catch (error) { next(error); }
    }

    // ── Assignments ────────────────────────────────────────────────────
    static async getMyAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;
            const { page, limit, skip } = parsePagination(req.query);

            // Find student's staff(s)
            const mappings = await prisma.staffStudentMapping.findMany({
                where: { studentId, deletedAt: null },
                select: { staffId: true },
            });

            if (mappings.length === 0) {
                successResponse(res, [], 'No assignments — not yet assigned to a staff member');
                return;
            }

            const staffIds = mappings.map(m => m.staffId);

            const [assignments, total] = await Promise.all([
                prisma.assignment.findMany({
                    where: { staffId: { in: staffIds }, deletedAt: null },
                    include: {
                        academicCycle: { select: { id: true, name: true } },
                        staff: { select: { id: true, firstName: true, lastName: true } },
                        submissions: {
                            where: { studentId },
                            select: { id: true, status: true, submittedAt: true, version: true, isLate: true },
                            orderBy: { version: 'desc' },
                        },
                    },
                    skip, take: limit, orderBy: { dueDate: 'asc' },
                }),
                prisma.assignment.count({ where: { staffId: { in: staffIds }, deletedAt: null } }),
            ]);

            successResponse(res, assignments, 'Your assignments', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    // ── Submit Assignment (with versioning + late handling) ─────────────
    static async submitAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;
            const { assignmentId, content } = req.body as { assignmentId: string; content?: string };

            // Verify assignment exists and belongs to the student's staff
            const mappings = await prisma.staffStudentMapping.findMany({
                where: { studentId, deletedAt: null },
                select: { staffId: true },
            });
            if (mappings.length === 0) throw new NotFoundError('Staff assignment');

            const staffIds = mappings.map(m => m.staffId);
            const assignment = await prisma.assignment.findFirst({
                where: { id: assignmentId, staffId: { in: staffIds }, deletedAt: null },
            });
            if (!assignment) throw new NotFoundError('Assignment');

            // Check for late submission
            const isLate = new Date() > assignment.dueDate;

            // Find existing submissions to determine version number
            const existingSubmissions = await prisma.submission.findMany({
                where: { assignmentId, studentId, deletedAt: null },
                orderBy: { version: 'desc' },
                take: 1,
            });

            const latestSubmission = existingSubmissions[0];

            // Prevent re-submission if already graded (must request re-evaluation instead)
            if (latestSubmission && latestSubmission.status === SubmissionStatus.GRADED) {
                throw new ConflictError(
                    'This assignment has already been graded. Please request a re-evaluation instead.',
                );
            }

            const nextVersion = latestSubmission ? latestSubmission.version + 1 : 1;

            // Store the uploaded PDF filename
            const fileUrl = req.file ? req.file.filename : undefined;

            const submission = await prisma.submission.create({
                data: {
                    assignmentId,
                    studentId,
                    content,
                    status: SubmissionStatus.SUBMITTED,
                    version: nextVersion,
                    isLate,
                    fileUrl,
                },
            });

            await logAudit({
                actorId: studentId,
                action: AuditAction.SUBMIT,
                resource: 'submissions',
                resourceId: submission.id,
                meta: { version: nextVersion, isLate, assignmentId },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            createdResponse(res, submission, isLate
                ? `Assignment submitted (Version ${nextVersion}) — ⚠️ Late submission`
                : `Assignment submitted successfully (Version ${nextVersion})`,
            );
        } catch (error) { next(error); }
    }

    // ── View Feedback & Grades ────────────────────────────────────────
    static async getMyGrades(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;

            const grades = await getOrSet(REDIS_KEYS.STUDENT_GRADES(studentId), CACHE_TTL.MEDIUM, () =>
                prisma.grade.findMany({
                    where: { studentId },
                    include: {
                        submission: {
                            include: {
                                assignment: { select: { id: true, title: true, maxGrade: true, dueDate: true } },
                                reviewComment: { select: { comment: true, createdAt: true } },
                                reEvalRequest: { select: { id: true, status: true, reason: true, staffResponse: true, createdAt: true } },
                            },
                        },
                        staff: { select: { id: true, firstName: true, lastName: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            );

            successResponse(res, grades, 'Your grades');
        } catch (error) { next(error); }
    }

    // ── View Submission Status ─────────────────────────────────────────
    static async getMySubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;
            const { page, limit, skip } = parsePagination(req.query);

            const [submissions, total] = await Promise.all([
                prisma.submission.findMany({
                    where: { studentId, deletedAt: null },
                    include: {
                        assignment: { select: { id: true, title: true, maxGrade: true, dueDate: true } },
                        grade: true,
                        reviewComment: true,
                    },
                    skip, take: limit, orderBy: { submittedAt: 'desc' },
                }),
                prisma.submission.count({ where: { studentId, deletedAt: null } }),
            ]);

            successResponse(res, submissions, 'Your submissions', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    // ── Request Re-Evaluation ──────────────────────────────────────────
    static async requestReEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;
            const { submissionId, reason } = req.body as { submissionId: string; reason: string };

            // Verify submission exists, belongs to student, and is graded
            const submission = await prisma.submission.findFirst({
                where: { id: submissionId, studentId, deletedAt: null },
                include: { grade: true, reEvalRequest: true },
            });

            if (!submission) throw new NotFoundError('Submission');
            if (submission.status !== SubmissionStatus.GRADED) {
                throw new BadRequestError('Only graded submissions can be re-evaluated');
            }
            if (submission.reEvalRequest && submission.reEvalRequest.status === ReEvalStatus.PENDING) {
                throw new ConflictError('A re-evaluation request is already pending for this submission');
            }

            const request = await prisma.reEvaluationRequest.upsert({
                where: { submissionId },
                update: {
                    reason,
                    status: ReEvalStatus.PENDING,
                    staffResponse: null,
                    resolvedAt: null,
                },
                create: {
                    submissionId,
                    studentId,
                    reason,
                },
            });

            await logAudit({
                actorId: studentId,
                action: AuditAction.CREATE,
                resource: 're_evaluations',
                resourceId: request.id,
                meta: { submissionId, reason },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            createdResponse(res, request, 'Re-evaluation request submitted');
        } catch (error) { next(error); }
    }

    // ── View My Re-Evaluation Requests ─────────────────────────────────
    static async getMyReEvaluations(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const studentId = req.user!.id;

            const requests = await prisma.reEvaluationRequest.findMany({
                where: { studentId },
                include: {
                    submission: {
                        include: {
                            assignment: { select: { id: true, title: true, maxGrade: true } },
                            grade: { select: { score: true, feedback: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            successResponse(res, requests, 'Your re-evaluation requests');
        } catch (error) { next(error); }
    }
}
