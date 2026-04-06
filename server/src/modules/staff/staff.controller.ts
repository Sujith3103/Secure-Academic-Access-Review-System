import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { successResponse, createdResponse } from '../../core/response';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../core/errors';
import { logAudit } from '../../shared/audit';
import { parsePagination, buildPaginationMeta } from '../../shared/pagination';
import { getOrSet, invalidateCache, invalidateCacheByPattern } from '../../shared/cache';
import { REDIS_KEYS, CACHE_TTL } from '../../config/redis';
import { AuditAction, SubmissionStatus, ReEvalStatus } from '@prisma/client';

export class StaffController {
    // ── View Assigned Students ─────────────────────────────────────────
    static async getAssignedStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { page, limit, skip } = parsePagination(req.query);

            const cacheKey = REDIS_KEYS.STAFF_STUDENTS(staffId);
            const data = await getOrSet(cacheKey, CACHE_TTL.MEDIUM, async () => {
                const [mappings, total] = await Promise.all([
                    prisma.staffStudentMapping.findMany({
                        where: { staffId, deletedAt: null },
                        include: {
                            student: { select: { id: true, email: true, firstName: true, lastName: true } },
                        },
                        skip, take: limit,
                    }),
                    prisma.staffStudentMapping.count({ where: { staffId, deletedAt: null } }),
                ]);
                return { mappings, total };
            });

            successResponse(res, data.mappings, 'Assigned students', 200, buildPaginationMeta(data.total, page, limit));
        } catch (error) { next(error); }
    }

    // ── Assignments ────────────────────────────────────────────────────
    static async createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { title, description, dueDate, maxGrade, academicCycleId } = req.body as {
                title: string; description: string; dueDate: string; maxGrade: number; academicCycleId: string;
            };

            const assignment = await prisma.assignment.create({
                data: {
                    title, description, staffId, academicCycleId,
                    dueDate: new Date(dueDate),
                    maxGrade: maxGrade ?? 100,
                    fileUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
                },
            });

            await invalidateCacheByPattern(`cache:cycle:${academicCycleId}:*`);
            await logAudit({ actorId: staffId, action: AuditAction.CREATE, resource: 'assignments', resourceId: assignment.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

            createdResponse(res, assignment, 'Assignment created');
        } catch (error) { next(error); }
    }

    static async getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { page, limit, skip } = parsePagination(req.query);

            const [assignments, total] = await Promise.all([
                prisma.assignment.findMany({
                    where: { staffId, deletedAt: null },
                    include: { academicCycle: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
                    skip, take: limit, orderBy: { createdAt: 'desc' },
                }),
                prisma.assignment.count({ where: { staffId, deletedAt: null } }),
            ]);

            successResponse(res, assignments, 'Assignments', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    // ── Submissions ────────────────────────────────────────────────────
    static async getSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { assignmentId } = req.params as { assignmentId: string };
            const { page, limit, skip } = parsePagination(req.query);

            // Ensure assignment belongs to this staff
            const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, staffId, deletedAt: null } });
            if (!assignment) throw new NotFoundError('Assignment');

            const [submissions, total] = await Promise.all([
                prisma.submission.findMany({
                    where: { assignmentId, deletedAt: null },
                    include: {
                        student: { select: { id: true, email: true, firstName: true, lastName: true } },
                        grade: true,
                        reviewComment: true,
                    },
                    skip, take: limit, orderBy: { submittedAt: 'desc' },
                }),
                prisma.submission.count({ where: { assignmentId, deletedAt: null } }),
            ]);

            successResponse(res, submissions, 'Submissions', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    static async reviewSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { submissionId } = req.params as { submissionId: string };
            const { comment } = req.body as { comment: string };

            const submission = await prisma.submission.findFirst({
                where: { id: submissionId, deletedAt: null },
                include: { assignment: true },
            });
            if (!submission) throw new NotFoundError('Submission');
            if (submission.assignment.staffId !== staffId) throw new ForbiddenError('Not your assignment');

            const reviewComment = await prisma.reviewComment.upsert({
                where: { submissionId },
                update: { comment, staffId },
                create: { submissionId, comment, staffId },
            });

            await prisma.submission.update({
                where: { id: submissionId },
                data: { status: SubmissionStatus.REVIEWED },
            });

            await logAudit({ actorId: staffId, action: AuditAction.REVIEW, resource: 'submissions', resourceId: submissionId, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
            await invalidateCache(REDIS_KEYS.STUDENT_GRADES(submission.studentId));

            successResponse(res, reviewComment, 'Review comment saved');
        } catch (error) { next(error); }
    }

    static async gradeSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { submissionId } = req.params as { submissionId: string };
            const { score, feedback } = req.body as { score: number; feedback?: string };

            const submission = await prisma.submission.findFirst({
                where: { id: submissionId, deletedAt: null },
                include: { assignment: true },
            });
            if (!submission) throw new NotFoundError('Submission');
            if (submission.assignment.staffId !== staffId) throw new ForbiddenError('Not your assignment');
            if (score > submission.assignment.maxGrade) {
                throw new BadRequestError(`Score cannot exceed max grade of ${submission.assignment.maxGrade}`);
            }

            const grade = await prisma.$transaction(async (tx) => {
                const g = await tx.grade.upsert({
                    where: { submissionId },
                    update: { score, feedback, staffId },
                    create: { submissionId, studentId: submission.studentId, staffId, score, feedback },
                });
                await tx.submission.update({ where: { id: submissionId }, data: { status: SubmissionStatus.GRADED } });
                return g;
            });

            await invalidateCache(REDIS_KEYS.STUDENT_GRADES(submission.studentId));
            await logAudit({ actorId: staffId, action: AuditAction.GRADE, resource: 'grades', resourceId: grade.id, meta: { score, submissionId }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

            successResponse(res, grade, 'Submission graded');
        } catch (error) { next(error); }
    }

    // ── Re-Evaluation Requests ─────────────────────────────────────────
    static async getReEvaluationRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { page, limit, skip } = parsePagination(req.query);

            // Get all re-evaluation requests for submissions linked to this staff's assignments
            const [requests, total] = await Promise.all([
                prisma.reEvaluationRequest.findMany({
                    where: {
                        submission: { assignment: { staffId } },
                    },
                    include: {
                        student: { select: { id: true, email: true, firstName: true, lastName: true } },
                        submission: {
                            include: {
                                assignment: { select: { id: true, title: true, maxGrade: true } },
                                grade: { select: { score: true, feedback: true } },
                            },
                        },
                    },
                    skip, take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.reEvaluationRequest.count({
                    where: { submission: { assignment: { staffId } } },
                }),
            ]);

            successResponse(res, requests, 'Re-evaluation requests', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    static async resolveReEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const staffId = req.user!.id;
            const { id } = req.params as { id: string };
            const { status, staffResponse, newScore, newFeedback } = req.body as {
                status: 'APPROVED' | 'REJECTED';
                staffResponse?: string;
                newScore?: number;
                newFeedback?: string;
            };

            const request = await prisma.reEvaluationRequest.findFirst({
                where: { id },
                include: {
                    submission: { include: { assignment: true, grade: true } },
                },
            });

            if (!request) throw new NotFoundError('Re-evaluation request');
            if (request.submission.assignment.staffId !== staffId) {
                throw new ForbiddenError('Not your assignment');
            }
            if (request.status !== ReEvalStatus.PENDING) {
                throw new BadRequestError('This request has already been resolved');
            }

            // Update the re-evaluation request
            const updated = await prisma.$transaction(async (tx) => {
                const result = await tx.reEvaluationRequest.update({
                    where: { id },
                    data: {
                        status: status === 'APPROVED' ? ReEvalStatus.APPROVED : ReEvalStatus.REJECTED,
                        staffResponse: staffResponse ?? null,
                        resolvedAt: new Date(),
                    },
                });

                // If approved and new score provided, update the grade
                if (status === 'APPROVED' && newScore !== undefined && request.submission.grade) {
                    await tx.grade.update({
                        where: { id: request.submission.grade.id },
                        data: {
                            score: newScore,
                            feedback: newFeedback ?? request.submission.grade.feedback,
                            staffId,
                        },
                    });
                }

                return result;
            });

            await invalidateCache(REDIS_KEYS.STUDENT_GRADES(request.studentId));
            await logAudit({
                actorId: staffId,
                action: AuditAction.REVIEW,
                resource: 're_evaluations',
                resourceId: id,
                meta: { status, submissionId: request.submissionId },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            successResponse(res, updated, `Re-evaluation ${status.toLowerCase()}`);
        } catch (error) { next(error); }
    }
}
