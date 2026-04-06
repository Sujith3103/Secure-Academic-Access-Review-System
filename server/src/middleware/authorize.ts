import { Request, Response, NextFunction } from 'express';
import { PolicyEngine } from '../policies/policyEngine';
import { Resource, Action } from '../policies/policyMatrix';
import { ForbiddenError, UnauthorizedError } from '../core/errors';

/**
 * Middleware factory that enforces policy-based authorization.
 * Usage: router.get('/resource', authenticate, authorize('resource', 'read'), handler)
 */
export function authorize(resource: Resource, action: Action) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new UnauthorizedError('Authentication required'));
            return;
        }

        const allowed = PolicyEngine.can(req.user.role, resource, action);

        if (!allowed) {
            next(
                new ForbiddenError(
                    `Your role (${req.user.role}) is not permitted to ${action} ${resource}`,
                ),
            );
            return;
        }

        next();
    };
}
