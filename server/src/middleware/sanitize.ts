import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * Recursively sanitize an object's string values against XSS.
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return xss(value.trim());
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        return sanitizeObject(value as Record<string, unknown>);
    }
    return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }
        result[key] = sanitizeValue(obj[key]);
    }
    return result;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body as Record<string, unknown>);
    }
    next();
}

export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
    }
    next();
}
