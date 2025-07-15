import { Redis } from '@upstash/redis';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private readonly CACHE_PREFIX = 'football:';
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000
    };
    try {
      await this.redis.setex(fullKey, ttl, JSON.stringify(entry));
      console.log(`✅ Cached: ${fullKey} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`❌ Cache set error for ${fullKey}:`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;
    try {
      const value = await this.redis.get(fullKey);
      if (!value) return null;

      // If value is already an object, return its data property or itself
      if (typeof value === 'object') {
        // Upstash may return the object directly
        return (value as any).data ?? value;
      }

      // Otherwise, parse as JSON
      const entry: CacheEntry<T> = JSON.parse(value as string);

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.redis.del(fullKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`❌ Cache get error for ${fullKey}:`, error);
      return null;
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
      }
    } catch (error) {
      console.error(`❌ Cache invalidation error:`, error);
    }
  }

  async getCacheStats(): Promise<{ keys: string[]; count: number }> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      return { keys, count: keys.length };
    } catch (error) {
      console.error(`❌ Cache stats error:`, error);
      return { keys: [], count: 0 };
    }
  }
}

export const cacheService = new CacheService(); 