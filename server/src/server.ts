import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, redis } from './config/redis';
import { logger } from './core/logger';
import app from './app';

const PORT = env.PORT;

async function bootstrap(): Promise<void> {
    try {
        logger.info('🚀 Starting SAARS API server...');

        await connectDatabase();
        await connectRedis();

        const server = app.listen(PORT, () => {
            logger.info(`✅ Server running on http://localhost:${PORT}`);
            logger.info(`📄 API Docs: http://localhost:${PORT}/api-docs`);
            logger.info(`🌍 Environment: ${env.NODE_ENV}`);
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`⚠️  ${signal} received. Shutting down gracefully...`);
            server.close(async () => {
                await disconnectDatabase();
                await redis.quit();
                logger.info('✅ Graceful shutdown complete');
                process.exit(0);
            });

            // Force shutdown after 10s
            setTimeout(() => {
                logger.error('❌ Forced shutdown due to timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception:', err);
            process.exit(1);
        });
        process.on('unhandledRejection', (err) => {
            logger.error('Unhandled rejection:', err);
            process.exit(1);
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();
