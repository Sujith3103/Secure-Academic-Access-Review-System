import { UserRole } from '@prisma/client';

// Resource definitions
export type Resource =
    | 'users'
    | 'assignments'
    | 'submissions'
    | 'grades'
    | 'academic_cycles'
    | 'staff_student_mappings'
    | 'audit_logs'
    | 'activity_logs'
    | 'bulk_upload'
    | 're_evaluations';

// Action definitions
export type Action = 'create' | 'read' | 'update' | 'delete' | 'assign' | 'grade' | 'submit' | 'review' | 'export' | 'view';

type PolicyMatrix = Record<UserRole, Partial<Record<Resource, Action[]>>>;

export const POLICY_MATRIX: PolicyMatrix = {
    [UserRole.ADMIN]: {
        users: ['create', 'read', 'update', 'delete'],
        assignments: ['create', 'read', 'update', 'delete'],
        submissions: ['read'],
        grades: ['read'],
        academic_cycles: ['create', 'read', 'update', 'delete'],
        staff_student_mappings: ['create', 'read', 'update', 'delete', 'assign'],
        audit_logs: ['read', 'export'],
        activity_logs: ['read'],
        bulk_upload: ['create'],
        re_evaluations: ['read'],
    },
    [UserRole.STAFF]: {
        users: ['read'],
        assignments: ['create', 'read', 'update'],
        submissions: ['read', 'review'],
        grades: ['create', 'read', 'update', 'grade'],
        academic_cycles: ['read'],
        staff_student_mappings: ['read'],
        audit_logs: [],
        activity_logs: ['read'],
        bulk_upload: [],
        re_evaluations: ['read', 'update'],
    },
    [UserRole.STUDENT]: {
        users: ['read'],
        assignments: ['read'],
        submissions: ['create', 'read', 'submit'],
        grades: ['read'],
        academic_cycles: ['read'],
        staff_student_mappings: ['read'],
        audit_logs: [],
        activity_logs: [],
        bulk_upload: [],
        re_evaluations: ['create', 'read'],
    },
};
