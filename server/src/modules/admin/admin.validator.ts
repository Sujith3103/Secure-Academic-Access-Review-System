import { z } from 'zod';

export const createCycleSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
    }).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
        message: 'End date must be after start date',
        path: ['endDate'],
    }),
});

export const assignStaffSchema = z.object({
    body: z.object({
        staffId: z.string().uuid(),
        studentIds: z.array(z.string().uuid()).min(1).max(20, 'Cannot assign more than 20 students at once'),
    }),
});

export const paginationQuerySchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        search: z.string().optional(),
        role: z.enum(['ADMIN', 'STAFF', 'STUDENT']).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
    }),
});

export type CreateCycleDto = z.infer<typeof createCycleSchema>['body'];
export type AssignStaffDto = z.infer<typeof assignStaffSchema>['body'];
