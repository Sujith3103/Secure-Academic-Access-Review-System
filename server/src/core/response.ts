import { Response } from 'express';

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    meta?: PaginationMeta;
    errors?: Record<string, string[]>;
    timestamp: string;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export function successResponse<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    meta?: PaginationMeta,
): Response {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
        meta,
        timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
}

export function createdResponse<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return successResponse(res, data, message, 201);
}

export function noContentResponse(res: Response): Response {
    return res.status(204).send();
}

export function errorResponse(
    res: Response,
    message: string,
    statusCode = 500,
    errors?: Record<string, string[]>,
    code?: string,
): Response {
    const response: ApiResponse<null> = {
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString(),
        ...(code && { code }),
    };
    return res.status(statusCode).json(response);
}
