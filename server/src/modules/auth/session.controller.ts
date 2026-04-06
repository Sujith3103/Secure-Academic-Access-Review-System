import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AuthService } from '../../services/auth.service';
import { successResponse } from '../../core/response';
import { NotFoundError } from '../../core/errors';
import { logAudit } from '../../shared/audit';
import { AuditAction } from '@prisma/client';

export class SessionController {
    /**
     * List all active sessions (non-revoked refresh tokens) for the authenticated user.
     */
    static async getUserSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;

            const sessions = await prisma.refreshToken.findMany({
                where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
                select: {
                    id: true,
                    createdAt: true,
                    expiresAt: true,
                    ipAddress: true,
                    userAgent: true,
                },
                orderBy: { createdAt: 'desc' },
            });

            successResponse(res, sessions, 'Active sessions');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Revoke a specific session by its refresh token ID.
     */
    static async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { sessionId } = req.params as { sessionId: string };

            const session = await prisma.refreshToken.findFirst({
                where: { id: sessionId, userId },
            });

            if (!session) throw new NotFoundError('Session');
            if (session.isRevoked) {
                successResponse(res, null, 'Session already revoked');
                return;
            }

            await prisma.refreshToken.update({
                where: { id: sessionId },
                data: { isRevoked: true },
            });

            await logAudit({
                actorId: userId,
                action: AuditAction.DELETE,
                resource: 'sessions',
                resourceId: sessionId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            successResponse(res, null, 'Session revoked successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Revoke all sessions except the current one (force logout from all other devices).
     */
    static async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;

            await AuthService.revokeAllUserTokens(userId);

            await logAudit({
                actorId: userId,
                action: AuditAction.DELETE,
                resource: 'sessions',
                meta: { action: 'revoke_all' },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            successResponse(res, null, 'All sessions revoked — you will need to login again');
        } catch (error) {
            next(error);
        }
    }
}
