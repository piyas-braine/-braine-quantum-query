import { type Signal, createSignal } from '../signals';
import { stableHash } from './utils';

export type QueryStatus = 'pending' | 'success' | 'error';
export type FetchDirection = 'initial' | 'next' | 'previous' | 'idle';

export interface QueryKey {
    key: readonly unknown[];
    params?: Record<string, unknown>;
}

export type QueryKeyInput = readonly unknown[] | QueryKey;

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
    isInvalidated?: boolean;
    promise?: Promise<T>; // For Suspense
}

import { QueryKeyTrie } from './trie';

export class QueryStorage {
    private signals = new Map<string, Signal<CacheEntry<unknown> | undefined>>();
    private gcTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private lruOrder = new Set<string>(); // Tracks access order (least to most recent)
    public trie = new QueryKeyTrie(); // 10/10: O(K) Lookup

    // Default configuration
    constructor(
        private defaultStaleTime: number = 5 * 60 * 1000, // 5 minutes - queries stay fresh
        private defaultCacheTime: number = 5 * 60 * 1000,
        private maxSize: number = 100 // Default limit to prevent memory overflow
    ) { }

    generateKey(queryKey: QueryKeyInput): string {
        const key = Array.isArray(queryKey) ? stableHash(queryKey) : stableHash([(queryKey as QueryKey).key, (queryKey as QueryKey).params]);
        return key;
    }

    get<T>(key: string, autoCreate = true): Signal<CacheEntry<T> | undefined> | undefined {
        let signal = this.signals.get(key);

        if (signal) {
            this.touch(key);
        }

        if (!signal && autoCreate) {
            const newSignal = createSignal<CacheEntry<unknown> | undefined>(undefined, {
                onActive: () => {
                    this.cancelGC(key);
                },
                onInactive: () => {
                    const currentEntry = this.signals.get(key)?.get();
                    const cacheTime = currentEntry?.cacheTime ?? this.defaultCacheTime;
                    this.scheduleGC(key, cacheTime);
                }
            });

            this.signals.set(key, newSignal);
            this.touch(key);

            // If created but not watched, schedule initial GC
            if (!newSignal.isWatched()) {
                this.scheduleGC(key, this.defaultCacheTime);
            }

            this.enforceMaxSize();
            signal = newSignal;
        }

        return signal as Signal<CacheEntry<T> | undefined> | undefined;
    }

    private tagIndex = new Map<string, Set<string>>();

    set<T>(key: string, entry: CacheEntry<T>): void {
        this.touch(key);

        // Update Tag Index
        const oldEntry = this.signals.get(key)?.get();
        if (oldEntry?.tags) {
            for (const tag of oldEntry.tags) {
                const set = this.tagIndex.get(tag);
                if (set) {
                    set.delete(key);
                    if (set.size === 0) this.tagIndex.delete(tag);
                }
            }
        }

        if (entry.tags) {
            for (const tag of entry.tags) {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                const tagSet = this.tagIndex.get(tag);
                if (tagSet) {
                    tagSet.add(key);
                }
            }
        }

        let signal = this.signals.get(key);
        if (signal) {
            signal.set(entry);
        } else {
            const newSignal = createSignal<CacheEntry<unknown> | undefined>(entry, {
                onActive: () => {
                    this.cancelGC(key);
                },
                onInactive: () => {
                    const entry = this.signals.get(key)?.get();
                    const cacheTime = entry?.cacheTime ?? this.defaultCacheTime;
                    this.scheduleGC(key, cacheTime);
                }
            });
            this.signals.set(key, newSignal);

            // If created but not watched, schedule initial GC
            if (!newSignal.isWatched()) {
                this.scheduleGC(key, entry.cacheTime ?? this.defaultCacheTime);
            }

            this.enforceMaxSize();
        }

        // 10/10 Indexing
        this.trie.insert(entry.key, key);
    }

    delete(key: string): void {
        const entry = this.signals.get(key)?.get();
        if (entry?.tags) {
            for (const tag of entry.tags) {
                const set = this.tagIndex.get(tag);
                if (set) {
                    set.delete(key);
                    if (set.size === 0) this.tagIndex.delete(tag);
                }
            }
        }

        if (entry?.key) {
            this.trie.remove(entry.key, key);
        }

        this.signals.delete(key);
        this.lruOrder.delete(key);
        this.cancelGC(key);
    }

    private touch(key: string): void {
        this.lruOrder.delete(key);
        this.lruOrder.add(key);
    }

    private enforceMaxSize(): void {
        if (this.signals.size <= this.maxSize) return;

        // Find the oldest inactive entry to evict
        for (const key of this.lruOrder) {
            const signal = this.signals.get(key);

            // 10/10 Logic: Evict oldest that has no active subscribers
            // Freshly created signals with 0 subscribers are now correctly identified via isWatched().
            if (signal && !signal.isWatched()) {
                this.delete(key);
                if (this.signals.size <= this.maxSize) break;
            }
        }
    }

    getKeysByTag(tag: string): Set<string> | undefined {
        return this.tagIndex.get(tag);
    }

    clear(): void {
        this.signals.clear();
        this.tagIndex.clear();
        this.trie = new QueryKeyTrie(); // Reset Trie
        this.lruOrder.clear();
        this.gcTimers.forEach(timer => clearTimeout(timer));
        this.gcTimers.clear();
    }

    getAll(): Map<string, CacheEntry<unknown>> {
        const map = new Map<string, CacheEntry<unknown>>();
        for (const [key, signal] of this.signals.entries()) {
            const val = signal.get();
            if (val) map.set(key, val);
        }
        return map;
    }

    getStats() {
        // console.log(`[Storage] STATS size=${this.signals.size} keys=${Array.from(this.signals.keys())}`);
        return {
            size: this.signals.size,
            keys: Array.from(this.signals.keys()),
            tags: this.tagIndex.size
        };
    }

    getSnapshot(): Map<string, CacheEntry<unknown>> {
        const snapshot = new Map<string, CacheEntry<unknown>>();
        for (const [key, signal] of this.signals.entries()) {
            const value = signal.get();
            if (value) {
                snapshot.set(key, value);
            }
        }
        return snapshot;
    }

    // --- GC Logic ---

    private scheduleGC(key: string, delay: number) {
        if (this.gcTimers.has(key)) {
            const timer = this.gcTimers.get(key);
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        }
        const timer = setTimeout(() => {
            this.delete(key);
        }, delay);
        this.gcTimers.set(key, timer);
    }

    private cancelGC(key: string) {
        if (this.gcTimers.has(key)) {
            const timer = this.gcTimers.get(key);
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            this.gcTimers.delete(key);
        }
    }
}
