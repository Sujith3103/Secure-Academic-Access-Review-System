import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly code?: string;

    constructor(
        message: string,
        statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
        isOperational = true,
        code?: string,
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]>;
    constructor(message: string, errors: Record<string, string[]> = {}) {
        super(message, StatusCodes.UNPROCESSABLE_ENTITY, true, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, StatusCodes.UNAUTHORIZED, true, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden: insufficient permissions') {
        super(message, StatusCodes.FORBIDDEN, true, 'FORBIDDEN');
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, StatusCodes.NOT_FOUND, true, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, StatusCodes.CONFLICT, true, 'CONFLICT');
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(message, StatusCodes.BAD_REQUEST, true, 'BAD_REQUEST');
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, StatusCodes.SERVICE_UNAVAILABLE, true, 'SERVICE_UNAVAILABLE');
    }
}
