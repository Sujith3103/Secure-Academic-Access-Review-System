import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AuthService } from '../../services/auth.service';
import { successResponse, createdResponse } from '../../core/response';
import { ConflictError, UnauthorizedError } from '../../core/errors';
import { logAudit, logActivity } from '../../shared/audit';
import { AuditAction, UserRole } from '@prisma/client';

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password, firstName, lastName, role } = req.body as {
                email: string;
                password: string;
                firstName: string;
                lastName: string;
                role?: UserRole;
            };

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) throw new ConflictError('User with this email already exists');

            const hashedPassword = await AuthService.hashPassword(password);
            const user = await prisma.user.create({
                data: { email, password: hashedPassword, firstName, lastName, role: role ?? UserRole.STUDENT },
                select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
            });

            await logAudit({
                actorId: user.id,
                action: AuditAction.CREATE,
                resource: 'users',
                resourceId: user.id,
                meta: { email: user.email, role: user.role },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            createdResponse(res, user, 'User registered successfully');
        } catch (error) {
            next(error);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password } = req.body as { email: string; password: string };

            const user = await prisma.user.findFirst({
                where: { email, deletedAt: null, isActive: true },
            });

            if (!user) throw new UnauthorizedError('Invalid credentials');

            const valid = await AuthService.comparePassword(password, user.password);
            if (!valid) throw new UnauthorizedError('Invalid credentials');

            const accessToken = AuthService.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });
            const refreshToken = AuthService.generateRefreshToken();
            await AuthService.saveRefreshToken(user.id, refreshToken, req.ip, req.headers['user-agent']);

            await logAudit({
                actorId: user.id,
                action: AuditAction.LOGIN,
                resource: 'auth',
                resourceId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            await logActivity(user.id, 'LOGIN', { email: user.email }, req.ip);

            successResponse(res, {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                },
            }, 'Login successful');
        } catch (error) {
            next(error);
        }
    }

    static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { refreshToken } = req.body as { refreshToken: string };

            const existing = await prisma.refreshToken.findFirst({
                where: { token: refreshToken, isRevoked: false },
                include: { user: { select: { id: true, email: true, role: true, isActive: true, deletedAt: true } } },
            });

            if (!existing || !existing.user.isActive || existing.user.deletedAt) {
                throw new UnauthorizedError('Invalid refresh token');
            }

            if (existing.expiresAt < new Date()) {
                throw new UnauthorizedError('Refresh token expired');
            }

            const newRefreshToken = await AuthService.rotateRefreshToken(refreshToken, existing.userId);
            const accessToken = AuthService.generateAccessToken({
                userId: existing.user.id,
                email: existing.user.email,
                role: existing.user.role,
            });

            successResponse(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed');
        } catch (error) {
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            const { refreshToken } = req.body as { refreshToken?: string };

            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                await AuthService.blacklistAccessToken(token);
            }

            if (refreshToken) {
                await prisma.refreshToken.updateMany({
                    where: { token: refreshToken },
                    data: { isRevoked: true },
                });
            }

            if (req.user) {
                await logAudit({
                    actorId: req.user.id,
                    action: AuditAction.LOGOUT,
                    resource: 'auth',
                    resourceId: req.user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                });
            }

            successResponse(res, null, 'Logged out successfully');
        } catch (error) {
            next(error);
        }
    }

    static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
            });
            successResponse(res, user, 'User profile');
        } catch (error) {
            next(error);
        }
    }
}
