import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack, correlationId, ...meta }) => {
    const base = `[${ts}] ${level.toUpperCase()} ${correlationId ? `[${correlationId}]` : ''}: ${message}`;
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return stack ? `${base}\n${stack}${metaStr}` : `${base}${metaStr}`;
});

const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        env.NODE_ENV === 'production' ? json() : combine(colorize(), consoleFormat),
    ),
    transports: [
        new winston.transports.Console(),
        ...(env.NODE_ENV === 'production'
            ? [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
            ]
            : []),
    ],
    exceptionHandlers: [
        new winston.transports.Console(),
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
    ],
});

export { logger };
