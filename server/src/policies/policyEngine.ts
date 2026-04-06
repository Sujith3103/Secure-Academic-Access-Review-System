import { UserRole } from '@prisma/client';
import { POLICY_MATRIX, Resource, Action } from './policyMatrix';

export class PolicyEngine {
    /**
     * Check if a role can perform an action on a resource
     */
    static can(role: UserRole, resource: Resource, action: Action): boolean {
        const rolePolicy = POLICY_MATRIX[role];
        if (!rolePolicy) return false;

        const allowedActions = rolePolicy[resource];
        if (!allowedActions) return false;

        return allowedActions.includes(action);
    }

    /**
     * Get all allowed actions for a role on a resource
     */
    static getAllowedActions(role: UserRole, resource: Resource): Action[] {
        const rolePolicy = POLICY_MATRIX[role];
        if (!rolePolicy) return [];
        return rolePolicy[resource] ?? [];
    }

    /**
     * Get all accessible resources for a role
     */
    static getAccessibleResources(role: UserRole): Resource[] {
        const rolePolicy = POLICY_MATRIX[role];
        if (!rolePolicy) return [];
        return Object.entries(rolePolicy)
            .filter(([, actions]) => actions && actions.length > 0)
            .map(([resource]) => resource as Resource);
    }
}
