import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '../core/errors';
import { errorResponse } from '../core/response';
import { logger } from '../core/logger';
import { env } from '../config/env';

export function globalErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
): void {
    // Zod validation errors
    if (err instanceof ZodError) {
        const errors = err.errors.reduce<Record<string, string[]>>((acc, issue) => {
            const path = issue.path.join('.') || 'root';
            if (!acc[path]) acc[path] = [];
            acc[path].push(issue.message);
            return acc;
        }, {});

        errorResponse(res, 'Validation failed', 422, errors, 'VALIDATION_ERROR');
        return;
    }

    // Custom app errors
    if (err instanceof ValidationError) {
        errorResponse(res, err.message, err.statusCode, err.errors, err.code);
        return;
    }

    if (err instanceof AppError) {
        if (!err.isOperational) {
            logger.error('Non-operational error:', err);
        }
        errorResponse(res, err.message, err.statusCode, undefined, err.code);
        return;
    }

    // Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                errorResponse(res, 'A record with this data already exists', 409, undefined, 'CONFLICT');
                return;
            case 'P2025':
                errorResponse(res, 'Record not found', 404, undefined, 'NOT_FOUND');
                return;
            case 'P2003':
                errorResponse(res, 'Referenced record does not exist', 400, undefined, 'FOREIGN_KEY_VIOLATION');
                return;
            default:
                logger.error('Prisma error:', { code: err.code, message: err.message });
                errorResponse(res, 'Database error', 500, undefined, 'DATABASE_ERROR');
                return;
        }
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        errorResponse(res, 'Invalid data format', 400, undefined, 'INVALID_DATA');
        return;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        errorResponse(res, 'Invalid token', 401, undefined, 'INVALID_TOKEN');
        return;
    }

    if (err.name === 'TokenExpiredError') {
        errorResponse(res, 'Token expired', 401, undefined, 'TOKEN_EXPIRED');
        return;
    }

    // Unknown errors
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
    });

    errorResponse(
        res,
        env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        500,
        undefined,
        'INTERNAL_SERVER_ERROR',
    );
}

export function notFoundHandler(req: Request, res: Response): void {
    errorResponse(res, `Route ${req.method} ${req.url} not found`, 404, undefined, 'ROUTE_NOT_FOUND');
}
