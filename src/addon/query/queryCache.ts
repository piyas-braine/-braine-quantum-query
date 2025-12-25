/**
 * Global Query Cache
 * Stores query results with TTL, supports invalidation and garbage collection
 */

import { stableHash } from './utils';

export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    staleTime: number;
    cacheTime: number;
}

export interface QueryKey {
    key: any[];
    params?: Record<string, any>;
}

export type QueryKeyInput = any[] | QueryKey;

export class QueryCache {
    private cache = new Map<string, CacheEntry>();
    private gcInterval: ReturnType<typeof setInterval> | null = null;
    private readonly defaultStaleTime = 0; // Immediately stale
    private readonly defaultCacheTime = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.startGarbageCollection();
    }

    /**
     * Generate cache key from query key array
     */
    private generateKey(queryKey: QueryKeyInput): string {
        if (Array.isArray(queryKey)) {
            return stableHash(queryKey);
        }
        return stableHash([queryKey.key, queryKey.params]);
    }

    /**
     * Get cached data if not expired
     */
    get<T>(queryKey: QueryKeyInput): T | undefined {
        const key = this.generateKey(queryKey);
        const entry = this.cache.get(key);

        if (!entry) return undefined;

        const now = Date.now();
        const age = now - entry.timestamp;

        // Remove if past cache time
        if (age > entry.cacheTime) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Check if data is stale
     */
    isStale(queryKey: QueryKeyInput): boolean {
        const key = this.generateKey(queryKey);
        const entry = this.cache.get(key);

        if (!entry) return true;

        const now = Date.now();
        const age = now - entry.timestamp;

        return age > entry.staleTime;
    }

    /**
     * Set cached data
     */
    set<T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: { staleTime?: number; cacheTime?: number }
    ): void {
        const key = this.generateKey(queryKey);

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            staleTime: options?.staleTime !== undefined ? options.staleTime : this.defaultStaleTime,
            cacheTime: options?.cacheTime !== undefined ? options.cacheTime : this.defaultCacheTime
        });
    }

    /**
     * Invalidate queries matching the key prefix
     */
    invalidate(queryKey: QueryKeyInput): void {
        const prefix = this.generateKey(queryKey);

        // Remove exact match
        this.cache.delete(prefix);

        // Remove all keys that start with this prefix
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix.slice(0, -1))) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Remove all cache entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Prefetch data (same as set but explicit intent)
     */
    prefetch<T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: { staleTime?: number; cacheTime?: number }
    ): void {
        this.set(queryKey, data, options);
    }

    /**
     * Garbage collection - remove expired entries
     */
    private startGarbageCollection(): void {
        this.gcInterval = setInterval(() => {
            const now = Date.now();

            for (const [key, entry] of this.cache.entries()) {
                const age = now - entry.timestamp;
                if (age > entry.cacheTime) {
                    this.cache.delete(key);
                }
            }
        }, 60 * 1000); // Run every minute
    }

    /**
     * Stop garbage collection
     */
    destroy(): void {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
            this.gcInterval = null;
        }
        this.clear();
    }

    /**
     * Get cache stats (for debugging)
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Global singleton instance
export const queryCache = new QueryCache();
