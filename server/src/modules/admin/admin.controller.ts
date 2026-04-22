import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { successResponse, createdResponse } from '../../core/response';
import { BadRequestError, NotFoundError } from '../../core/errors';
import { logAudit } from '../../shared/audit';
import { parsePagination, parseFilters, buildPaginationMeta } from '../../shared/pagination';
import { getOrSet, invalidateCache, invalidateCacheByPattern } from '../../shared/cache';
import { REDIS_KEYS, CACHE_TTL } from '../../config/redis';
import { AuditAction, UserRole } from '@prisma/client';
import { parse as csvParse } from 'csv-parse/sync';
import fs from 'fs';

import { AuthService } from '../../services/auth.service';

export class AdminController {
    // ─── Academic Cycles ─────────────────────────────────────────────────
    static async createCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { name, description, startDate, endDate } = req.body as {
                name: string; description?: string; startDate: string; endDate: string;
            };

            const cycle = await prisma.academicCycle.create({
                data: { name, description, startDate: new Date(startDate), endDate: new Date(endDate) },
            });

            await invalidateCacheByPattern('cache:cycle:*');
            await logAudit({ actorId: req.user!.id, action: AuditAction.CREATE, resource: 'academic_cycles', resourceId: cycle.id, ipAddress: req.ip });

            createdResponse(res, cycle, 'Academic cycle created');
        } catch (error) { next(error); }
    }

    static async getCycles(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { page, limit, skip } = parsePagination(req.query);

            const [cycles, total] = await Promise.all([
                prisma.academicCycle.findMany({ where: { deletedAt: null }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
                prisma.academicCycle.count({ where: { deletedAt: null } }),
            ]);

            successResponse(res, cycles, 'Academic cycles', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    static async updateCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params as { id: string };
            const data = req.body as Record<string, unknown>;

            const cycle = await prisma.academicCycle.update({ where: { id }, data });
            await invalidateCacheByPattern('cache:cycle:*');
            await logAudit({ actorId: req.user!.id, action: AuditAction.UPDATE, resource: 'academic_cycles', resourceId: id, ipAddress: req.ip });

            successResponse(res, cycle, 'Academic cycle updated');
        } catch (error) { next(error); }
    }

    static async deleteCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params as { id: string };
            await prisma.academicCycle.update({ where: { id }, data: { deletedAt: new Date() } });
            await logAudit({ actorId: req.user!.id, action: AuditAction.DELETE, resource: 'academic_cycles', resourceId: id, ipAddress: req.ip });
            successResponse(res, null, 'Academic cycle deleted');
        } catch (error) { next(error); }
    }

    // ─── User Management ──────────────────────────────────────────────────
    static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { page, limit, skip } = parsePagination(req.query);
            const { search, role } = parseFilters(req.query);

            const where = {
                deletedAt: null,
                ...(role ? { role: role as UserRole } : {}),
                ...(search ? {
                    OR: [
                        { email: { contains: search, mode: 'insensitive' as const } },
                        { firstName: { contains: search, mode: 'insensitive' as const } },
                        { lastName: { contains: search, mode: 'insensitive' as const } },
                    ],
                } : {}),
            };

            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
                }),
                prisma.user.count({ where }),
            ]);

            successResponse(res, users, 'Users', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    static async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params as { id: string };
            await prisma.user.update({ where: { id }, data: { isActive: false } });
            await invalidateCache(REDIS_KEYS.USER_CACHE(id));
            await AuthService.revokeAllUserTokens(id);
            await logAudit({ actorId: req.user!.id, action: AuditAction.UPDATE, resource: 'users', resourceId: id, meta: { action: 'deactivate' }, ipAddress: req.ip });
            successResponse(res, null, 'User deactivated');
        } catch (error) { next(error); }
    }

    // ─── Staff-Student Assignment ─────────────────────────────────────────
    static async assignStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { staffId, studentIds } = req.body as { staffId: string; studentIds: string[] };

            // Verify staff exists and has STAFF role
            const staff = await prisma.user.findFirst({ where: { id: staffId, role: UserRole.STAFF, deletedAt: null } });
            if (!staff) throw new NotFoundError('Staff member');

            // Check current student count for this staff
            const currentCount = await prisma.staffStudentMapping.count({
                where: { staffId, deletedAt: null },
            });

            if (currentCount + studentIds.length > 20) {
                throw new BadRequestError(`Staff member already has ${currentCount} students. Cannot exceed 20 total.`);
            }

            // Create mappings in a transaction (skip duplicates)
            const result = await prisma.$transaction(
                studentIds.map((studentId) =>
                    prisma.staffStudentMapping.upsert({
                        where: { staffId_studentId: { staffId, studentId } },
                        update: { deletedAt: null },
                        create: { staffId, studentId },
                    }),
                ),
            );

            await invalidateCache(REDIS_KEYS.STAFF_STUDENTS(staffId));
            await logAudit({
                actorId: req.user!.id,
                action: AuditAction.ASSIGN,
                resource: 'staff_student_mappings',
                meta: { staffId, studentIds, count: result.length },
                ipAddress: req.ip,
            });

            createdResponse(res, result, `Assigned ${result.length} student(s) to staff`);
        } catch (error) { next(error); }
    }

    static async getStaffStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { staffId } = req.params as { staffId: string };
            const { limit, skip } = parsePagination(req.query);

            const cacheKey = REDIS_KEYS.STAFF_STUDENTS(staffId);
            const mappings = await getOrSet(cacheKey, CACHE_TTL.MEDIUM, () =>
                prisma.staffStudentMapping.findMany({
                    where: { staffId, deletedAt: null },
                    include: {
                        student: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                    },
                    skip,
                    take: limit,
                }),
            );

            successResponse(res, mappings, 'Staff students');
        } catch (error) { next(error); }
    }

    // ─── Bulk CSV Onboarding ──────────────────────────────────────────────
    static async bulkUploadStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            if (!req.file) throw new BadRequestError('CSV file is required');

            const csvContent = fs.readFileSync(req.file.path, 'utf-8');

            // Clean up temp CSV file
            fs.unlinkSync(req.file.path);

            const records = csvParse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            }) as Array<{ email: string; firstName: string; lastName: string; password?: string }>;

            if (records.length === 0) throw new BadRequestError('CSV file is empty');
            if (records.length > 500) throw new BadRequestError('CSV file cannot exceed 500 records');

            const results = { created: 0, skipped: 0, errors: [] as string[] };

            // Process in chunks of 50
            const chunkSize = 50;
            for (let i = 0; i < records.length; i += chunkSize) {
                const chunk = records.slice(i, i + chunkSize);
                await prisma.$transaction(async (tx) => {
                    for (const record of chunk) {
                        if (!record.email || !record.firstName || !record.lastName) {
                            results.errors.push(`Row ${i + chunk.indexOf(record) + 2}: Missing required fields`);
                            results.skipped++;
                            continue;
                        }

                        const existing = await tx.user.findUnique({ where: { email: record.email } });
                        if (existing) {
                            results.skipped++;
                            continue;
                        }

                        const password = await AuthService.hashPassword(record.password || 'Saars@2024!');
                        await tx.user.create({
                            data: { email: record.email, firstName: record.firstName, lastName: record.lastName, password, role: UserRole.STUDENT },
                        });
                        results.created++;
                    }
                });
            }



            await logAudit({
                actorId: req.user!.id,
                action: AuditAction.UPLOAD,
                resource: 'bulk_upload',
                meta: results,
                ipAddress: req.ip,
            });

            successResponse(res, results, 'Bulk upload completed');
        } catch (error) { next(error); }
    }

    // ─── Audit Logs ───────────────────────────────────────────────────────
    static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { page, limit, skip } = parsePagination(req.query);
            const { search } = parseFilters(req.query);
            const { action, resource: resourceFilter, userId, startDate, endDate } = req.query as {
                action?: string; resource?: string; userId?: string; startDate?: string; endDate?: string;
            };

            const where: Record<string, unknown> = {};

            if (action) where.action = { equals: action as AuditAction };
            if (resourceFilter) where.resource = { contains: resourceFilter };
            if (userId) where.actorId = userId;
            if (startDate || endDate) {
                where.createdAt = {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                };
            }
            if (search) {
                where.OR = [
                    { resource: { contains: search } },
                    { actor: { email: { contains: search, mode: 'insensitive' } } },
                ];
            }

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        actor: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
                    },
                }),
                prisma.auditLog.count({ where }),
            ]);

            successResponse(res, logs, 'Audit logs', 200, buildPaginationMeta(total, page, limit));
        } catch (error) { next(error); }
    }

    // ─── System Stats ──────────────────────────────────────────────────────
    static async getSystemStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const [
                totalUsers,
                adminCount,
                staffCount,
                studentCount,
                totalCycles,
                activeCycles,
                totalAssignments,
                totalSubmissions,
                gradedSubmissions,
                totalAuditLogs,
                recentLogins,
            ] = await Promise.all([
                prisma.user.count({ where: { deletedAt: null } }),
                prisma.user.count({ where: { role: UserRole.ADMIN, deletedAt: null } }),
                prisma.user.count({ where: { role: UserRole.STAFF, deletedAt: null } }),
                prisma.user.count({ where: { role: UserRole.STUDENT, deletedAt: null } }),
                prisma.academicCycle.count({ where: { deletedAt: null } }),
                prisma.academicCycle.count({ where: { isActive: true, deletedAt: null } }),
                prisma.assignment.count({ where: { deletedAt: null } }),
                prisma.submission.count({ where: { deletedAt: null } }),
                prisma.submission.count({ where: { status: 'GRADED', deletedAt: null } }),
                prisma.auditLog.count(),
                prisma.auditLog.count({
                    where: {
                        action: AuditAction.LOGIN,
                        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                    },
                }),
            ]);

            successResponse(res, {
                users: { total: totalUsers, admins: adminCount, staff: staffCount, students: studentCount },
                cycles: { total: totalCycles, active: activeCycles },
                assignments: { total: totalAssignments },
                submissions: { total: totalSubmissions, graded: gradedSubmissions },
                auditLogs: { total: totalAuditLogs },
                activity: { loginsLast24h: recentLogins },
            }, 'System statistics');
        } catch (error) { next(error); }
    }
}

