/**
 * Global Query Cache
 * Stores query results with TTL, supports invalidation and garbage collection
 */

import { stableHash } from './utils';
import { type Signal, createSignal } from '../signals';

export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    staleTime: number;
    cacheTime: number;
    key: any[];
}

export interface QueryKey {
    key: any[];
    params?: Record<string, any>;
}

export type QueryKeyInput = any[] | QueryKey;

export class QueryCache {
    // Store signals instead of raw values
    private signals = new Map<string, Signal<CacheEntry | undefined>>();
    private gcInterval: ReturnType<typeof setInterval> | null = null;
    private readonly defaultStaleTime = 0; // Immediately stale
    private readonly defaultCacheTime = 5 * 60 * 1000; // 5 minutes

    constructor(config?: { enableGC?: boolean }) {
        if (config?.enableGC !== false) {
            this.startGarbageCollection();
        }
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
     * Get data (wrapper around signal.get)
     */
    get<T>(queryKey: QueryKeyInput): T | undefined {
        const key = this.generateKey(queryKey);
        const signal = this.signals.get(key);

        if (!signal) return undefined;

        const entry = signal.get();
        if (!entry) return undefined;

        const now = Date.now();
        const age = now - entry.timestamp;

        // Remove if past cache time
        if (age > entry.cacheTime) {
            this.signals.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Get Signal for a key (Low level API for hooks)
     * Automatically creates a signal if one doesn't exist
     */
    getSignal<T>(queryKey: QueryKeyInput): Signal<CacheEntry<T> | undefined> {
        const key = this.generateKey(queryKey);
        let signal = this.signals.get(key);

        if (!signal) {
            // Lazy creation of signal with undefined initial value
            signal = createSignal<CacheEntry<T> | undefined>(undefined);
            this.signals.set(key, signal);
        }

        return signal as Signal<CacheEntry<T> | undefined>;
    }

    /**
     * Check if data is stale
     */
    isStale(queryKey: QueryKeyInput): boolean {
        const key = this.generateKey(queryKey);
        const signal = this.signals.get(key);

        if (!signal) return true;

        const entry = signal.get();
        if (!entry) return true;

        const now = Date.now();
        const age = now - entry.timestamp;

        return age > entry.staleTime;
    }

    /**
     * Set cached data (updates signal)
     */
    set<T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: { staleTime?: number; cacheTime?: number }
    ): void {
        const key = this.generateKey(queryKey);
        const entry: CacheEntry = {
            data,
            timestamp: Date.now(),
            staleTime: options?.staleTime !== undefined ? options.staleTime : this.defaultStaleTime,
            cacheTime: options?.cacheTime !== undefined ? options.cacheTime : this.defaultCacheTime,
            key: Array.isArray(queryKey) ? queryKey : [queryKey]
        };

        const existingSignal = this.signals.get(key);
        if (existingSignal) {
            existingSignal.set(entry);
        } else {
            this.signals.set(key, createSignal<CacheEntry<T> | undefined>(entry));
        }

        // Trigger onQueryUpdated hooks
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [queryKey.key, queryKey.params];
        this.plugins.forEach(p => p.onQueryUpdated?.(normalizedKey, data));
    }

    // --- DEDUPLICATION ---
    private deduplicationCache = new Map<string, Promise<any>>();

    // --- MIDDLEWARE / PLUGINS ---
    private plugins: import('./types').QueryPlugin[] = [];

    /**
     * Register a middleware plugin
     */
    use(plugin: import('./types').QueryPlugin): this {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Fetch data with deduplication.
     * If a request for the same key is already in flight, returns the existing promise.
     */
    async fetch<T>(queryKey: QueryKeyInput, fn: () => Promise<T>): Promise<T> {
        const key = this.generateKey(queryKey);
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [queryKey.key, queryKey.params];

        // Return existing promise if in flight
        if (this.deduplicationCache.has(key)) {
            return this.deduplicationCache.get(key) as Promise<T>;
        }

        // Trigger onFetchStart hooks
        this.plugins.forEach(p => p.onFetchStart?.(normalizedKey));

        // Create new promise
        const promise = fn().then(
            (data) => {
                this.deduplicationCache.delete(key);
                // Trigger onFetchSuccess hooks
                this.plugins.forEach(p => p.onFetchSuccess?.(normalizedKey, data));
                return data;
            },
            (error) => {
                this.deduplicationCache.delete(key);
                // Trigger onFetchError hooks
                this.plugins.forEach(p => p.onFetchError?.(normalizedKey, error));
                throw error;
            }
        );

        this.deduplicationCache.set(key, promise);
        return promise;
    }

    /**
     * Invalidate queries matching the key prefix
     * Marks them as undefined to trigger refetches without breaking subscriptions
     */
    invalidate(queryKey: QueryKeyInput): void {
        const prefix = this.generateKey(queryKey);
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [queryKey.key, queryKey.params];

        // Trigger onInvalidate hooks
        this.plugins.forEach(p => p.onInvalidate?.(normalizedKey));

        const invalidateKey = (key: string) => {
            const signal = this.signals.get(key);
            if (signal) {
                // Soft invalidation: Set to undefined to trigger listeners
                signal.set(undefined);
            }
        };

        // Exact match
        invalidateKey(prefix);

        // Prefix matches
        for (const key of this.signals.keys()) {
            if (key.startsWith(prefix.slice(0, -1))) {
                invalidateKey(key);
            }
        }
    }


    /**
     * Remove all cache entries
     */
    clear(): void {
        this.signals.clear();
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

            for (const [key, signal] of this.signals.entries()) {
                const entry = signal.get();
                if (!entry) continue;

                const age = now - entry.timestamp;
                if (age > entry.cacheTime) {
                    this.signals.delete(key);
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
            size: this.signals.size,
            keys: Array.from(this.signals.keys())
        };
    }

    /**
     * Get all entries (wrapper for DevTools)
     */
    getAll(): Map<string, CacheEntry> {
        const map = new Map<string, CacheEntry>();
        for (const [key, signal] of this.signals.entries()) {
            const val = signal.get();
            if (val) map.set(key, val);
        }
        return map;
    }
}

// Global singleton instance
export const queryCache = new QueryCache();
