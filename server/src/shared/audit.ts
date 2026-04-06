import { prisma } from '../config/database';
import { AuditAction, Prisma } from '@prisma/client';
import { logger } from '../core/logger';

interface AuditLogParams {
    actorId?: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    status?: 'SUCCESS' | 'FAILURE';
    meta?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                actorId: params.actorId ?? null,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId ?? null,
                status: params.status ?? 'SUCCESS',
                meta: (params.meta ?? {}) as Prisma.InputJsonValue,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
            },
        });
    } catch (error) {
        // Audit logging must never crash the main request
        logger.error('Failed to write audit log', { error, params });
    }
}

/**
 * Log a failed action (e.g. unauthorized access, validation failure) to audit trail.
 */
export async function logAuditFailure(params: Omit<AuditLogParams, 'status'>): Promise<void> {
    await logAudit({ ...params, status: 'FAILURE' });
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>, ipAddress?: string): Promise<void> {
    try {
        await prisma.activityLog.create({
            data: {
                userId,
                action,
                details: (details ?? {}) as Prisma.InputJsonValue,
                ipAddress: ipAddress ?? null,
            },
        });
    } catch (error) {
        logger.error('Failed to write activity log', { error, userId, action });
    }
}
