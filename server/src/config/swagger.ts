import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';
import { env } from './env';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SAARS — Secure Academic Access Review System',
            version: '1.0.0',
            description: 'Production-grade academic access review platform with RBAC, token rotation, and audit trails.',
            contact: { name: 'SAARS Team', email: 'admin@saars.io' },
        },
        servers: [
            { url: `http://localhost:${env.PORT}${env.API_PREFIX}`, description: 'Development' },
            { url: `https://api.saars.io${env.API_PREFIX}`, description: 'Production' },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: {},
                        timestamp: { type: 'string', format: 'date-time' },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        code: { type: 'string' },
                        errors: { type: 'object' },
                        timestamp: { type: 'string', format: 'date-time' },
                    },
                },
                PaginationMeta: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        hasNextPage: { type: 'boolean' },
                        hasPrevPage: { type: 'boolean' },
                    },
                },
            },
        },
        security: [{ BearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication — login, register, token management' },
            { name: 'Admin', description: 'Admin-only — users, cycles, staff assignment, bulk upload' },
            { name: 'Staff', description: 'Staff-only — assignments, submissions, grading' },
            { name: 'Student', description: 'Student-only — assignments, submissions, grades' },
        ],
    },
    apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.controller.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export const swaggerUi = swaggerUiExpress;
