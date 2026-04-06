import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/logger';

export function performanceLogger(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const correlationId = uuidv4();
    req.correlationId = correlationId;

    res.setHeader('X-Correlation-Id', correlationId);

    res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000; // ms
        const memUsage = process.memoryUsage();

        logger.http('Request completed', {
            correlationId,
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            durationMs: duration.toFixed(2),
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            userId: req.user?.id,
            memoryMb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        });
    });

    next();
}
