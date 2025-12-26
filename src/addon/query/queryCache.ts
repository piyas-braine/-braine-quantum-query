/**
 * Global Query Cache (Facade)
 * Orchestrates QueryStorage and QueryRemotes.
 */

import { QueryStorage, type QueryKeyInput, type CacheEntry, type FetchDirection, type QueryKey } from './queryStorage';
import { QueryRemotes } from './remotes';
import { MutationCache } from './mutationCache';
import { PluginManager } from './pluginManager';
import { type Signal } from '../signals';

export type { QueryKeyInput, CacheEntry, QueryStatus, FetchDirection, QueryKey } from './queryStorage';

export class QueryCache {
    // Components
    private storage: QueryStorage;
    private remotes: QueryRemotes;

    // Mutation Cache
    public mutationCache = new MutationCache();

    // Plugins
    private pluginManager = new PluginManager();

    // Config defaults
    private readonly defaultStaleTime: number;
    private readonly defaultCacheTime: number;

    constructor(config?: { defaultStaleTime?: number; defaultCacheTime?: number }) {
        this.defaultStaleTime = config?.defaultStaleTime ?? 0;
        this.defaultCacheTime = config?.defaultCacheTime ?? 5 * 60 * 1000;

        this.storage = new QueryStorage(this.defaultStaleTime, this.defaultCacheTime);
        this.remotes = new QueryRemotes();
    }

    // --- FACADE API ---

    /**
     * Get data from storage
     */
    get = <T>(queryKey: QueryKeyInput): T | undefined => {
        const key = this.storage.generateKey(queryKey);
        const signal = this.storage.get<T>(key, false); // Do not auto-create

        if (!signal) return undefined;

        const entry = signal.get();

        if (!entry) return undefined;

        const now = Date.now();
        const age = now - entry.timestamp;

        if (age > entry.cacheTime) {
            this.storage.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Get Signal for reactivity (used by hooks)
     */
    getSignal = <T>(queryKey: QueryKeyInput): Signal<CacheEntry<T> | undefined> => {
        const key = this.storage.generateKey(queryKey);
        // Hooks DO want auto-creation
        return this.storage.get<T>(key, true)!;
    }

    /**
     * Set data manually (Optimistic updates / Prefetch)
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
        const key = this.storage.generateKey(queryKey);

        const entry: CacheEntry<T> = {
            data,
            status: 'success',
            error: null,
            isFetching: false,
            fetchDirection: 'idle',
            timestamp: Date.now(),
            staleTime: options?.staleTime ?? this.defaultStaleTime,
            cacheTime: options?.cacheTime ?? this.defaultCacheTime,
            key: queryKey,
            tags: options?.tags
        };

        this.storage.set(key, entry as CacheEntry);

        // Trigger Plugins
        const normalizedKey = this.normalizeKey(queryKey);
        this.pluginManager.onQueryUpdated(normalizedKey, data);
    }

    /**
     * Restore cache entry (Hydration)
     */
    restore = (queryKey: QueryKeyInput, entry: CacheEntry<any>): void => {
        const key = this.storage.generateKey(queryKey);
        this.storage.set(key, entry);

        // Trigger Plugins?
        // Usually hydration shouldn't trigger updates as it's initial state?
        // But if we hydrate later, we might want to notify.
        // For now, let's notify.
        const normalizedKey = this.normalizeKey(queryKey);
        this.pluginManager.onQueryUpdated(normalizedKey, entry.data);
    }

    /**
     * Fetch data (Orchestration)
     */
    fetch = async <T>(
        queryKey: QueryKeyInput,
        fn: (context: { signal?: AbortSignal }) => Promise<T>,
        options?: {
            fetchDirection?: FetchDirection;
            signal?: AbortSignal;
            retry?: number | boolean;
            retryDelay?: number | ((attemptIndex: number) => number);
        }
    ): Promise<T> => {
        const key = this.storage.generateKey(queryKey);
        const normalizedKey = this.normalizeKey(queryKey);
        const direction = options?.fetchDirection || 'initial';

        // 1. Update Signal: Fetching Start
        const signal = this.storage.get<T>(key, true)!;  // Force create
        const currentEntry = signal.get();

        // Safe update of signal state without losing data
        this.storage.set(key, {
            data: currentEntry?.data,
            status: currentEntry?.status || 'pending',
            error: null,
            isFetching: true, // Mark fetching
            fetchDirection: direction,
            timestamp: currentEntry?.timestamp || Date.now(),
            staleTime: currentEntry?.staleTime ?? this.defaultStaleTime,
            cacheTime: currentEntry?.cacheTime ?? this.defaultCacheTime,
            key: queryKey,
            tags: currentEntry?.tags
        } as CacheEntry<T>); // Explicit cast to satisfy strictness if needed

        this.pluginManager.onFetchStart(normalizedKey);

        try {
            // 2. Execute Remote Fetch (Deduplicated)
            const data = await this.remotes.fetch(key, fn, {
                signal: options?.signal,
                retry: options?.retry,
                retryDelay: options?.retryDelay
            });

            this.pluginManager.onFetchSuccess(normalizedKey, data);
            return data;

        } catch (error) {
            // 3. Handle Error
            const current = signal.get();
            if (current) {
                this.storage.set(key, {
                    ...current,
                    status: 'error',
                    error: error as Error,
                    isFetching: false,
                    fetchDirection: 'idle'
                });
            }

            this.pluginManager.onFetchError(normalizedKey, error as Error);
            throw error;
        }
    }

    /**
     * Invalidate queries
     */
    invalidate = (queryKey: QueryKeyInput): void => {
        const prefix = this.storage.generateKey(queryKey);
        const normalizedKey = this.normalizeKey(queryKey);

        this.pluginManager.onInvalidate(normalizedKey);

        // Soft invalidation logic
        const allKeys = this.storage.getSnapshot().keys();
        for (const key of allKeys) {
            if (key === prefix || key.startsWith(prefix.slice(0, -1))) {
                // We set the signal to undefined? 
                // Previous logic set it to undefined to trigger listeners.
                // Or we can just mark it stale if we had a boolean?
                // Setting to undefined forces a refresh in observers.
                const signal = this.storage.get(key, false);
                if (signal) {
                    const current = signal.get();
                    if (current) {
                        signal.set({ ...current, isInvalidated: true });
                    }
                }
            }
        }
    }

    invalidateTags = (tags: string[]): void => {
        const tagsToInvalidate = new Set(tags);
        const snapshot = this.storage.getSnapshot();

        for (const [key, signal] of snapshot.entries()) {
            const entry = signal.get();
            if (entry && entry.tags) {
                if (entry.tags.some(tag => tagsToInvalidate.has(tag))) {
                    signal.set({ ...entry, isInvalidated: true });
                }
            }
        }
    }

    // --- Helpers ---

    use = (plugin: import('./types').QueryPlugin): this => {
        this.pluginManager.add(plugin);
        return this;
    }

    isStale = (queryKey: QueryKeyInput): boolean => {
        // Should delegate to storage but depends on calculation?
        // Storage has the data.
        const key = this.storage.generateKey(queryKey);
        const signal = this.storage.get(key);
        const entry = signal?.get();
        if (!entry) return true;
        if (entry.isInvalidated) return true;
        return (Date.now() - entry.timestamp) > entry.staleTime;
    }

    getAll = () => this.storage.getAll();
    snapshot = () => this.storage.getSnapshot();
    clear = () => this.storage.clear();
    remove = (key: QueryKeyInput) => this.storage.delete(this.storage.generateKey(key));

    // Restored Methods
    prefetch = <T>(
        queryKey: QueryKeyInput,
        data: T,
        options?: { staleTime?: number; cacheTime?: number }
    ): void => {
        this.set(queryKey, data, options);
    }

    destroy = (): void => {
        this.storage.clear(); // Clears timers and data
    }

    getStats = () => this.storage.getStats();

    // For Hydration
    getSnapshot = () => this.storage.getSnapshot();

    invalidateAll = (): void => {
        for (const key of this.storage.getSnapshot().keys()) {
            const signal = this.storage.get(key);
            const entry = signal?.get();
            if (entry) {
                signal?.set({ ...entry, isInvalidated: true });
            }
        }
    }

    private normalizeKey(queryKey: QueryKeyInput): unknown[] {
        return Array.isArray(queryKey) ? queryKey : [(queryKey as QueryKey).key, (queryKey as QueryKey).params];
    }
}
