import Redis from 'ioredis';
import { env } from './env';

const redisConfig = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    username: env.REDIS_USERNAME,
    retryStrategy: (times: number): number | null => {
        if (times > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return null;
        }
        return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));
redis.on('close', () => console.warn('⚠️  Redis connection closed'));

export async function connectRedis(): Promise<void> {
    try {
        await redis.connect();
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        process.exit(1);
    }
}

// Redis key prefixes
export const REDIS_KEYS = {
    ACCESS_TOKEN_BLACKLIST: (token: string) => `blacklist:access:${token}`,
    REFRESH_TOKEN_BLACKLIST: (token: string) => `blacklist:refresh:${token}`,
    USER_CACHE: (userId: string) => `cache:user:${userId}`,
    STAFF_STUDENTS: (staffId: string) => `cache:staff:${staffId}:students`,
    ASSIGNMENTS: (cycleId: string) => `cache:cycle:${cycleId}:assignments`,
    STUDENT_GRADES: (studentId: string) => `cache:student:${studentId}:grades`,
    AUDIT_LOGS: (page: number) => `cache:audit:page:${page}`,
} as const;

export const CACHE_TTL = {
    SHORT: 60,        // 1 minute
    MEDIUM: 300,      // 5 minutes
    LONG: 1800,       // 30 minutes
    VERY_LONG: 86400, // 24 hours
} as const;
