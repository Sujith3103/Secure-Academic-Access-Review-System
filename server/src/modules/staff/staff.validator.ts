import { z } from 'zod';

export const createAssignmentSchema = z.object({
    body: z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        dueDate: z.string().datetime(),
        maxGrade: z.number().min(1).max(1000).default(100),
        academicCycleId: z.string().uuid(),
    }),
});

export const reviewSubmissionSchema = z.object({
    body: z.object({
        comment: z.string().min(1).max(2000),
    }),
});

export const gradeSubmissionSchema = z.object({
    body: z.object({
        score: z.number().min(0),
        feedback: z.string().optional(),
    }),
});

export const resolveReEvalSchema = z.object({
    body: z.object({
        status: z.enum(['APPROVED', 'REJECTED']),
        staffResponse: z.string().max(2000).optional(),
        newScore: z.number().min(0).optional(),
        newFeedback: z.string().optional(),
    }),
});

export type CreateAssignmentDto = z.infer<typeof createAssignmentSchema>['body'];
export type ReviewSubmissionDto = z.infer<typeof reviewSubmissionSchema>['body'];
export type GradeSubmissionDto = z.infer<typeof gradeSubmissionSchema>['body'];
export type ResolveReEvalDto = z.infer<typeof resolveReEvalSchema>['body'];
