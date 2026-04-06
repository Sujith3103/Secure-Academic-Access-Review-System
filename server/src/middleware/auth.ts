import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { redis, REDIS_KEYS } from '../config/redis';
import { UnauthorizedError, ForbiddenError } from '../core/errors';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            correlationId?: string;
        }
    }
}

export interface TokenPayload extends JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.split(' ')[1];

        // Check blacklist
        const isBlacklisted = await redis.get(REDIS_KEYS.ACCESS_TOKEN_BLACKLIST(token));
        if (isBlacklisted) {
            throw new UnauthorizedError('Token has been revoked');
        }

        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

        // Fetch user from DB to ensure still active
        const user = await prisma.user.findFirst({
            where: { id: decoded.userId, isActive: true, deletedAt: null },
            select: { id: true, email: true, role: true, firstName: true, lastName: true },
        });

        if (!user) {
            throw new UnauthorizedError('User not found or deactivated');
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
}

export function requireRoles(...roles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new UnauthorizedError());
            return;
        }
        if (!roles.includes(req.user.role)) {
            next(new ForbiddenError(`Access restricted to: ${roles.join(', ')}`));
            return;
        }
        next();
    };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        next();
        return;
    }
    authenticate(req, res, next);
}
