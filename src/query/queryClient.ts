/**
 * Global Query Cache (Facade)
 * Orchestrates QueryStorage and QueryRemotes.
 */

import { QueryStorage, type QueryKeyInput, type CacheEntry, type FetchDirection, type QueryKey } from './queryStorage';
import { QueryRemotes } from './remotes';
import { MutationCache } from './mutationCache';
import { PluginManager } from './pluginManager';
import type { QueryPlugin, Schema } from './types';
import { type Signal } from '../signals';
import { validateWithSchema } from './plugins/validation';
import { QueryError, reportError } from './errors';

export type { QueryKeyInput, CacheEntry, QueryStatus, FetchDirection, QueryKey } from './queryStorage';
export { QueryError, ErrorType, reportError, errorReporter } from './errors';

export class QueryClient {
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
    private readonly defaultSchema?: Schema<unknown>;

    constructor(config?: import('./types').QueryClientConfig) {
        this.defaultStaleTime = config?.defaultStaleTime ?? (5 * 60 * 1000); // 5 minutes
        this.defaultCacheTime = config?.defaultCacheTime ?? 5 * 60 * 1000;
        this.defaultSchema = config?.defaultSchema;

        this.storage = new QueryStorage(
            this.defaultStaleTime,
            this.defaultCacheTime,
            config?.maxCacheSize
        );
        this.remotes = new QueryRemotes();
        this.pluginManager.setClient(this);
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

        if (!this.isCacheEntry<T>(entry)) return undefined;

        const now = Date.now();
        const age = now - entry.timestamp;

        if (age > entry.cacheTime) {
            this.storage.delete(key);
            return undefined;
        }

        return entry.data;
    }

    /**
     * Get Signal for reactivity (used by hooks)
     */
    getSignal = <T>(queryKey: QueryKeyInput): Signal<CacheEntry<T> | undefined> => {
        const key = this.storage.generateKey(queryKey);
        // Hooks DO want auto-creation
        const signal = this.storage.get<T>(key, true);

        if (!signal) {
            throw new Error(`[Quantum] Failed to create signal for query key: ${JSON.stringify(queryKey)}`);
        }

        return signal;
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

        this.storage.set(key, entry);

        // Trigger Plugins
        const normalizedKey = this.normalizeKey(queryKey);
        this.pluginManager.onQueryUpdated(normalizedKey, data);
    }

    /**
     * Restore cache entry (Hydration)
     */
    restore = (queryKey: QueryKeyInput, entry: CacheEntry<unknown>): void => {
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
            tags?: string[];
            schema?: Schema<T>;
        }
    ): Promise<T> => {
        const key = this.storage.generateKey(queryKey);
        const normalizedKey = this.normalizeKey(queryKey);
        const direction = options?.fetchDirection || 'initial';

        // 1. Update Signal: Fetching Start
        const signal = this.storage.get<T>(key, true);  // Force create

        if (!signal) {
            throw new Error(`[Quantum] Failed to create signal for query key: ${JSON.stringify(queryKey)}`);
        }

        const currentEntry = signal.get();
        const mergedTags = options?.tags ?? currentEntry?.tags;

        // 1. Update Signal: Fetching Start
        this.storage.set(key, {
            data: currentEntry?.data,
            status: currentEntry?.status || 'pending',
            error: null,
            isFetching: true,
            fetchDirection: direction,
            timestamp: currentEntry?.timestamp || Date.now(),
            staleTime: currentEntry?.staleTime ?? this.defaultStaleTime,
            cacheTime: currentEntry?.cacheTime ?? this.defaultCacheTime,
            key: queryKey,
            tags: mergedTags
        });

        this.pluginManager.onFetchStart(normalizedKey);

        try {
            // 2. Execute Remote Fetch (Deduplicated)
            const data = await this.remotes.fetch(key, fn, {
                signal: options?.signal,
                retry: options?.retry,
                retryDelay: options?.retryDelay
            });

            this.storage.set(key, {
                data,
                status: 'success',
                error: null,
                isFetching: false,
                isInvalidated: undefined, // Clear invalidation on success
                fetchDirection: 'idle',
                timestamp: Date.now(),
                staleTime: currentEntry?.staleTime ?? this.defaultStaleTime,
                cacheTime: currentEntry?.cacheTime ?? this.defaultCacheTime,
                key: queryKey,
                tags: mergedTags
            });

            // 3. Optional Schema Validation
            const schema = options?.schema || this.defaultSchema;
            const validatedData = validateWithSchema(data, schema as Schema<T>);

            this.pluginManager.onFetchSuccess(normalizedKey, validatedData);
            return validatedData;

        } catch (error) {
            // 3. Handle Error
            const err = error instanceof Error ? error : new Error(String(error));
            this.storage.set(key, {
                data: currentEntry?.data,
                status: 'error',
                error: err,
                isFetching: false,
                fetchDirection: 'idle',
                timestamp: currentEntry?.timestamp || Date.now(),
                staleTime: currentEntry?.staleTime ?? this.defaultStaleTime,
                cacheTime: currentEntry?.cacheTime ?? this.defaultCacheTime,
                key: queryKey,
                tags: mergedTags
            });

            this.pluginManager.onFetchError(normalizedKey, err);
            throw err;
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

        // Optimized O(1) Lookup
        for (const tag of tagsToInvalidate) {
            const keys = this.storage.getKeysByTag(tag);
            if (keys) {
                for (const key of keys) {
                    const signal = this.storage.get(key, false); // Don't create
                    if (signal) {
                        const current = signal.get();
                        if (current) {
                            signal.set({ ...current, isInvalidated: true });
                        }
                    }
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

    /**
     * Check if a query key exists in the cache
     */
    has = (queryKey: QueryKeyInput): boolean => {
        const key = this.storage.generateKey(queryKey);
        const signal = this.storage.get(key, false);
        return signal !== undefined && signal.get() !== undefined;
    }

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
        const snapshot = this.storage.getSnapshot();
        for (const key of snapshot.keys()) {
            const signal = this.storage.get(key, false);
            const entry = signal?.get();
            if (entry) {
                signal?.set({ ...entry, isInvalidated: true });
            }
        }
    }

    private normalizeKey(queryKey: QueryKeyInput): unknown[] {
        return Array.isArray(queryKey) ? queryKey : [(queryKey as QueryKey).key, (queryKey as QueryKey).params];
    }

    private isCacheEntry<T>(entry: unknown): entry is CacheEntry<T> {
        return entry !== null && typeof entry === 'object' && 'status' in entry && 'timestamp' in entry;
    }

    // --- DEBUGGER API (For DevTools) ---

    debugSet = <T>(key: QueryKeyInput, data: T): void => {
        this.set(key, data);
    }

    debugInvalidate = (key: QueryKeyInput): void => {
        this.invalidate(key);
    }
}
