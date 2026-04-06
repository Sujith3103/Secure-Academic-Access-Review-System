import { redis } from '../config/redis';
import { logger } from '../core/logger';

/**
 * Cache-aside helper: returns cached data or fetches and caches it.
 */
export async function getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    try {
        const cached = await redis.get(key);
        if (cached) {
            return JSON.parse(cached) as T;
        }
    } catch (err) {
        logger.warn('Redis cache read failed, falling through to DB', { key, err });
    }

    const data = await fetcher();

    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
        logger.warn('Redis cache write failed', { key, err });
    }

    return data;
}

/**
 * Invalidate one or more cache keys.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
        await redis.del(...keys);
    } catch (err) {
        logger.warn('Redis cache invalidation failed', { keys, err });
    }
}

/**
 * Invalidate all keys matching a pattern (use sparingly).
 */
export async function invalidateCacheByPattern(pattern: string): Promise<void> {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } catch (err) {
        logger.warn('Redis pattern invalidation failed', { pattern, err });
    }
}
