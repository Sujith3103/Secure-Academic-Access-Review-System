import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { performanceLogger } from './middleware/performance';
import { sanitizeBody, sanitizeQuery } from './middleware/sanitize';
import { generalRateLimiter } from './middleware/rateLimiter';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { swaggerSpec, swaggerUi } from './config/swagger';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import staffRoutes from './modules/staff/staff.routes';
import studentRoutes from './modules/student/student.routes';

const app = express();

// ── Security Headers ──────────────────────────────────────────────────
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
        },
    },
}));

// ── CORS ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000','https://secure-academic-access-review-syste.vercel.app'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
}));

// ── Body Parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Request Middleware ────────────────────────────────────────────────
app.use(performanceLogger);
app.use(sanitizeBody);
app.use(sanitizeQuery);

// ── Global Rate Limiter ───────────────────────────────────────────────
app.use(generalRateLimiter);

// ── Static Files ───────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── Swagger Docs ──────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SAARS API Documentation',
}));

// ── Health Check ──────────────────────────────────────────────────────
app.get(`${env.API_PREFIX}/health`, (_req, res) => {
    res.json({
        success: true,
        message: 'SAARS API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
    });
});

// ── API Routes ────────────────────────────────────────────────────────
app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/admin`, adminRoutes);
app.use(`${env.API_PREFIX}/staff`, staffRoutes);
app.use(`${env.API_PREFIX}/student`, studentRoutes);

// ── Error Handling ────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
