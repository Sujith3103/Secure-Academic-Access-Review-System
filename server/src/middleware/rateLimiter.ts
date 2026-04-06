import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API rate limiter
export const generalRateLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    keyGenerator: (req) => req.ip ?? 'unknown',
    skip: (_req) => env.NODE_ENV === 'test',
});

// Stricter rate limiter for auth endpoints (15 minutes window)
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again in 15 minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
    skip: (_req) => env.NODE_ENV === 'test',
});

// Stricter rate limiter for file upload endpoints
export const uploadRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Upload limit exceeded. Please try again in an hour.',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    },
    skip: (_req) => env.NODE_ENV === 'test',
});
