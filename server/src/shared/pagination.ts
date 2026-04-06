import { Request } from 'express';
import { PaginationMeta } from '../core/response';

export interface PaginationParams {
    page: number;
    limit: number;
    skip: number;
}

export interface FilterParams {
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    [key: string]: unknown;
}

export function parsePagination(query: Request['query']): PaginationParams {
    const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '10'), 10)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export function parseFilters(query: Request['query']): FilterParams {
    const { page, limit, ...rest } = query;
    void page; void limit;

    return {
        search: rest.search ? String(rest.search) : undefined,
        sortBy: rest.sortBy ? String(rest.sortBy) : 'createdAt',
        sortOrder: rest.sortOrder === 'asc' ? 'asc' : 'desc',
        ...rest,
    };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
    };
}
