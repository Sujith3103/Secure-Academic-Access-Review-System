import { Router } from 'express';
import { AuthController } from './auth.controller';
import { SessionController } from './session.controller';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { validateRequest } from '../../middleware/validate';
import { loginSchema, registerSchema, refreshTokenSchema } from './auth.validator';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 */
router.post('/register', authRateLimiter, validateRequest(registerSchema), AuthController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive tokens
 */
router.post('/login', authRateLimiter, validateRequest(loginSchema), AuthController.login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get new access token
 */
router.post('/refresh', validateRequest(refreshTokenSchema), AuthController.refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and blacklist tokens
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile
 */
router.get('/me', authenticate, AuthController.getMe);

// ── Session Management ──────────────────────────────────────────────────

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     tags: [Auth]
 *     summary: List active sessions for the authenticated user
 */
router.get('/sessions', authenticate, SessionController.getUserSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke a specific session
 */
router.delete('/sessions/:sessionId', authenticate, SessionController.revokeSession);

/**
 * @swagger
 * /auth/sessions:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke all sessions (force logout from all devices)
 */
router.delete('/sessions', authenticate, SessionController.revokeAllSessions);

export default router;
