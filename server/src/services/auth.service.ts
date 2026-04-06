import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { redis, REDIS_KEYS } from '../config/redis';
import { prisma } from '../config/database';
import { TokenPayload } from '../middleware/auth';
import { UnauthorizedError } from '../core/errors';
import { UserRole } from '@prisma/client';

const SALT_ROUNDS = 12;

export class AuthService {
    // Password
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS);
    }

    static async comparePassword(plain: string, hashed: string): Promise<boolean> {
        return bcrypt.compare(plain, hashed);
    }

    // Access token
    static generateAccessToken(payload: { userId: string; email: string; role: UserRole }): string {
        return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN as string & {},
            issuer: 'saars-api',
            audience: 'saars-client',
        } as jwt.SignOptions);
    }

    // Refresh token
    static generateRefreshToken(): string {
        return uuidv4() + '-' + Date.now().toString(36);
    }

    static async saveRefreshToken(
        userId: string,
        token: string,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<void> {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await prisma.refreshToken.create({
            data: {
                token,
                userId,
                expiresAt,
                ipAddress: ipAddress ?? null,
                userAgent: userAgent ?? null,
            },
        });
    }

    /**
     * Rotate refresh token: revoke old, save new, return new.
     */
    static async rotateRefreshToken(oldToken: string, userId: string): Promise<string> {
        const existing = await prisma.refreshToken.findFirst({
            where: { token: oldToken, userId, isRevoked: false },
        });

        if (!existing) {
            throw new UnauthorizedError('Invalid or revoked refresh token');
        }

        if (existing.expiresAt < new Date()) {
            throw new UnauthorizedError('Refresh token expired');
        }

        // Revoke old token
        await prisma.refreshToken.update({
            where: { id: existing.id },
            data: { isRevoked: true },
        });

        // Blacklist old token hash in Redis
        await redis.setex(
            REDIS_KEYS.REFRESH_TOKEN_BLACKLIST(oldToken),
            7 * 24 * 60 * 60,
            '1',
        );

        // Issue new refresh token
        const newToken = AuthService.generateRefreshToken();
        await AuthService.saveRefreshToken(userId, newToken);

        return newToken;
    }

    /**
     * Blacklist the access token in Redis (on logout).
     */
    static async blacklistAccessToken(token: string): Promise<void> {
        try {
            const decoded = jwt.decode(token) as TokenPayload | null;
            if (decoded?.exp) {
                const ttl = decoded.exp - Math.floor(Date.now() / 1000);
                if (ttl > 0) {
                    await redis.setex(REDIS_KEYS.ACCESS_TOKEN_BLACKLIST(token), ttl, '1');
                }
            }
        } catch {
            // Silently fail blacklisting on invalid tokens
        }
    }

    /**
     * Revoke all refresh tokens for a user (force logout from all devices).
     */
    static async revokeAllUserTokens(userId: string): Promise<void> {
        await prisma.refreshToken.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });
    }

    static verifyAccessToken(token: string): TokenPayload {
        try {
            return jwt.verify(token, env.JWT_ACCESS_SECRET, {
                issuer: 'saars-api',
                audience: 'saars-client',
            }) as TokenPayload;
        } catch {
            throw new UnauthorizedError('Invalid or expired token');
        }
    }
}
