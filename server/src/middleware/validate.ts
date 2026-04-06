import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../core/errors';

type ValidationSchema = AnyZodObject;

export function validateRequest(schema: ValidationSchema) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.reduce<Record<string, string[]>>((acc, issue) => {
                    const path = issue.path.slice(1).join('.') || 'root'; // strip 'body' prefix
                    if (!acc[path]) acc[path] = [];
                    acc[path].push(issue.message);
                    return acc;
                }, {});
                next(new ValidationError('Validation failed', errors));
            } else {
                next(error);
            }
        }
    };
}
