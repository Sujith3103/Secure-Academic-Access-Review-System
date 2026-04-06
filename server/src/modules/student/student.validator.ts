import { z } from 'zod';

export const createSubmissionSchema = z.object({
    body: z.object({
        assignmentId: z.string().uuid(),
        content: z.string().optional(),
    }),
});

export const reEvaluationSchema = z.object({
    body: z.object({
        submissionId: z.string().uuid(),
        reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
    }),
});

export type CreateSubmissionDto = z.infer<typeof createSubmissionSchema>['body'];
export type ReEvaluationDto = z.infer<typeof reEvaluationSchema>['body'];
