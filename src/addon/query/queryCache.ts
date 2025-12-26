/**
 * Global Query Cache
 * Stores query results with TTL, supports invalidation and garbage collection
 */

import { stableHash } from './utils';
import { type Signal, createSignal } from '../signals';
import { MutationCache } from './mutationCache';

export type QueryStatus = 'pending' | 'success' | 'error';
export type FetchDirection = 'initial' | 'next' | 'previous' | 'idle';

export interface CacheEntry<T = unknown> {
    data: T | undefined;
    status: QueryStatus;
    error: Error | null;
    isFetching: boolean;
    fetchDirection: FetchDirection;
    timestamp: number;
    staleTime: number;
    cacheTime: number;
    key: QueryKeyInput;
    tags?: string[];
}

export interface QueryKey {
    key: readonly unknown[];
    params?: Record<string, unknown>;
}

export type QueryKeyInput = readonly unknown[] | QueryKey;

export class QueryCache {
    // Store signals instead of raw values
    private signals = new Map<string, Signal<CacheEntry | undefined>>();
    // Mutation Cache
    public mutationCache = new MutationCache();

    private readonly defaultStaleTime: number = 0; // Immediately stale
    private readonly defaultCacheTime: number = 5 * 60 * 1000; // 5 minutes

    constructor(config?: { defaultStaleTime?: number; defaultCacheTime?: number }) {
        if (config?.defaultStaleTime !== undefined) this.defaultStaleTime = config.defaultStaleTime;
        if (config?.defaultCacheTime !== undefined) this.defaultCacheTime = config.defaultCacheTime;
    }

    /**
     * Generate cache key from query key array
     */
    private generateKey = (queryKey: QueryKeyInput): string => {
        if (Array.isArray(queryKey)) {
            return stableHash(queryKey);
        }
        const input = queryKey as QueryKey;
        return stableHash([input.key, input.params]);
    }

    /**
     * Get data (wrapper around signal.get)
     */
    get = <T>(queryKey: QueryKeyInput): T | undefined => {
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

    // --- GARBAGE COLLECTION ---
    private gcTimers = new Map<string, ReturnType<typeof setTimeout>>();

    private scheduleGC = (key: string, cacheTime: number) => {
        // If already scheduled, clear it
        if (this.gcTimers.has(key)) {
            clearTimeout(this.gcTimers.get(key)!);
        }

        const timer = setTimeout(() => {
            this.signals.delete(key);
            this.gcTimers.delete(key);
        }, cacheTime);

        this.gcTimers.set(key, timer);
    }

    private cancelGC = (key: string) => {
        if (this.gcTimers.has(key)) {
            clearTimeout(this.gcTimers.get(key)!);
            this.gcTimers.delete(key);
        }
    }

    /**
     * Get Signal for a key (Low level API for hooks)
     * Automatically creates a signal if one doesn't exist
     */
    getSignal = <T>(queryKey: QueryKeyInput): Signal<CacheEntry<T> | undefined> => {
        const key = this.generateKey(queryKey);
        let signal = this.signals.get(key);

        if (!signal) {
            // Lazy creation of signal with undefined initial value
            // We use 'any' cast because Signal generic type is tricky with undefined initial
            signal = createSignal<CacheEntry | undefined>(undefined, {
                onActive: () => {
                    this.cancelGC(key);
                },
                onInactive: () => {
                    // When last observer leaves, schedule GC
                    // We need the latest cacheTime from the entry
                    const entry = this.signals.get(key)?.get();
                    const cacheTime = entry?.cacheTime ?? this.defaultCacheTime;
                    this.scheduleGC(key, cacheTime);
                }
            });
            this.signals.set(key, signal);
        }

        return signal as unknown as Signal<CacheEntry<T> | undefined>;
    }

    /**
     * Check if data is stale
     */
    isStale = (queryKey: QueryKeyInput): boolean => {
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
    /**
     * Set cached data (updates signal)
     */
    set = <T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: {
            staleTime?: number;
            cacheTime?: number;
            fetchDirection?: FetchDirection;
            tags?: string[];
        }
    ): void => {
        const key = this.generateKey(queryKey);
        // If entry exists, preserve other fields? Usually set invalidates 'error' and 'isFetching'.
        // But for infinite query, we might want to preserve some things? 
        // No, 'set' usually implies "I have the new data, I am done".

        const entry: CacheEntry = {
            data,
            status: 'success',
            error: null,
            isFetching: false,
            fetchDirection: 'idle', // Reset to idle on success
            timestamp: Date.now(),
            staleTime: options?.staleTime !== undefined ? options.staleTime : this.defaultStaleTime,
            cacheTime: options?.cacheTime !== undefined ? options.cacheTime : this.defaultCacheTime,
            key: Array.isArray(queryKey) ? queryKey : [queryKey],
            tags: options?.tags
        };

        const existingSignal = this.signals.get(key);
        if (existingSignal) {
            existingSignal.set(entry);
        } else {
            this.signals.set(key, createSignal<CacheEntry | undefined>(entry));
        }

        // Trigger onQueryUpdated hooks
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [(queryKey as QueryKey).key, (queryKey as QueryKey).params];
        this.plugins.forEach(p => p.onQueryUpdated?.(normalizedKey, data));
    }

    // ... (deduplication cache and plugins unchanged)

    // --- DEDUPLICATION ---
    private deduplicationCache = new Map<string, Promise<any>>();

    // --- MIDDLEWARE / PLUGINS ---
    private plugins: import('./types').QueryPlugin[] = [];

    /**
     * Register a middleware plugin
     */
    use = (plugin: import('./types').QueryPlugin): this => {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Fetch data with deduplication.
     */
    /**
     * Fetch data with deduplication.
     */
    fetch = async <T>(
        queryKey: QueryKeyInput,
        fn: (context: { signal?: AbortSignal }) => Promise<T>,
        options?: {
            fetchDirection?: FetchDirection;
            signal?: AbortSignal;
        }
    ): Promise<T> => {
        const key = this.generateKey(queryKey);
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [(queryKey as QueryKey).key, (queryKey as QueryKey).params];
        const direction = options?.fetchDirection || 'initial';

        // Return existing promise if in flight
        // We should arguably cancel the EXISTING promise if a NEW signal comes in?
        // Or just let the existing one finish?
        // TanStack Query behavior: deduplicates. If new observer mounts, it attaches to existing promise.
        // If ALL observers unmount, we cancel.
        // For now, simple dedupe.
        if (this.deduplicationCache.has(key)) {
            return this.deduplicationCache.get(key) as Promise<T>;
        }

        // Update Signal State: Fetching Start
        const signal = this.getSignal<T>(queryKey);
        const currentEntry = signal.get();

        signal.set({
            data: currentEntry?.data, // Keep old data
            status: currentEntry?.status || 'pending',
            error: null, // Clear error
            isFetching: true,
            fetchDirection: direction,
            timestamp: currentEntry?.timestamp || Date.now(),
            staleTime: currentEntry?.staleTime ?? this.defaultStaleTime,
            cacheTime: currentEntry?.cacheTime ?? this.defaultCacheTime,
            key: currentEntry?.key || (Array.isArray(queryKey) ? queryKey : [queryKey])
        } as CacheEntry<T>); // Cast to strict T

        // Trigger onFetchStart hooks
        this.plugins.forEach(p => p.onFetchStart?.(normalizedKey));

        // Create new promise
        const promise = fn({ signal: options?.signal }).then(
            (data) => {
                this.deduplicationCache.delete(key);
                // Trigger onFetchSuccess hooks
                this.plugins.forEach(p => p.onFetchSuccess?.(normalizedKey, data));
                return data;
            },
            (error) => {
                this.deduplicationCache.delete(key);

                // Update Signal State: Fetch Error
                const current = signal.get();
                if (current) {
                    signal.set({
                        ...current,
                        status: 'error',
                        error: error,
                        isFetching: false,
                        fetchDirection: 'idle'
                    });
                }

                // Trigger onFetchError hooks
                this.plugins.forEach(p => p.onFetchError?.(normalizedKey, error));
                throw error;
            }
        );

        this.deduplicationCache.set(key, promise);

        // Handle external signal aborting (optional optimization to remove from cache?)
        // If options.signal is aborted, we might not be able to "abort" the promise if it's shared.
        // But we are passing it to `fn`.

        return promise;
    }

    /**
     * Invalidate all queries
     */
    invalidateAll = (): void => {
        for (const key of this.signals.keys()) {
            this.signals.get(key)?.set(undefined);
        }
    }

    /**
     * Remove a specific query from cache
     */
    remove = (queryKey: QueryKeyInput): void => {
        const key = this.generateKey(queryKey);
        this.signals.delete(key);
    }

    /**
     * Invalidate queries matching the key prefix
     * Marks them as undefined to trigger refetches without breaking subscriptions
     */
    invalidate = (queryKey: QueryKeyInput): void => {
        const prefix = this.generateKey(queryKey);
        const normalizedKey = Array.isArray(queryKey) ? queryKey : [(queryKey as QueryKey).key, (queryKey as QueryKey).params];

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
     * Invalidate queries matching specific tags.
     */
    invalidateTags = (tags: string[]): void => {
        const tagsToInvalidate = new Set(tags);

        // Trigger onInvalidateTags logic (if we had plugins for it)

        for (const [key, signal] of this.signals.entries()) {
            const entry = signal.get();
            if (entry && entry.tags) {
                // Check if any intersection
                const hasMatch = entry.tags.some(tag => tagsToInvalidate.has(tag));
                if (hasMatch) {
                    // Soft invalidation
                    signal.set(undefined);
                }
            }
        }
    }


    /**
     * Remove all cache entries
     */
    clear = (): void => {
        this.signals.clear();
    }

    /**
     * Prefetch data (same as set but explicit intent)
     */
    prefetch = <T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: { staleTime?: number; cacheTime?: number }
    ): void => {
        this.set(queryKey, data, options);
    }

    /**
     * Stop garbage collection (cleaning up pending timers)
     */
    destroy = (): void => {
        for (const timer of this.gcTimers.values()) {
            clearTimeout(timer);
        }
        this.gcTimers.clear();
        this.signals.clear();
    }

    /**
     * Get cache stats (for debugging)
     */
    getStats = () => {
        return {
            size: this.signals.size,
            keys: Array.from(this.signals.keys())
        };
    }

    /**
     * Get all entries (wrapper for DevTools)
     */
    getAll = (): Map<string, CacheEntry> => {
        const map = new Map<string, CacheEntry>();
        for (const [key, signal] of this.signals.entries()) {
            const val = signal.get();
            if (val) map.set(key, val);
        }
        return map;
    }

    /**
     * Get all active query signals (for Dehydration).
     */
    snapshot = (): Map<string, Signal<CacheEntry<any> | undefined>> => {
        return this.signals;
    }
}

// Global singleton removed to enforce Clean Architecture
// export const queryCache = new QueryCache();
