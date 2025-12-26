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
}

export class QueryStorage {
    private signals = new Map<string, Signal<CacheEntry | undefined>>();
    private gcTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // Default configuration
    constructor(
        private defaultStaleTime: number = 0,
        private defaultCacheTime: number = 5 * 60 * 1000
    ) { }

    generateKey(queryKey: QueryKeyInput): string {
        const key = Array.isArray(queryKey) ? stableHash(queryKey) : stableHash([(queryKey as QueryKey).key, (queryKey as QueryKey).params]);
        // console.log(`[Storage] Hash: ${JSON.stringify(queryKey)} -> ${key}`);
        return key;
    }

    get<T>(key: string, autoCreate = true): Signal<CacheEntry<T> | undefined> | undefined {
        let signal = this.signals.get(key);

        // console.log(`[Storage] GET ${key} found=${!!signal} autoCreate=${autoCreate}`);

        if (!signal && autoCreate) {
            // console.log(`[Storage] RE-CREATING ${key}`);
            const newSignal = createSignal<CacheEntry<unknown> | undefined>(undefined, {
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
            signal = newSignal;
        }

        if (!signal) return undefined;

        return signal as unknown as Signal<CacheEntry<T> | undefined>;
    }

    set(key: string, entry: CacheEntry): void {
        // console.log(`[Storage] SET ${key}`);
        const signal = this.signals.get(key);
        if (signal) {
            signal.set(entry);
        } else {
            this.signals.set(key, createSignal<CacheEntry | undefined>(entry, {
                onActive: () => {
                    this.cancelGC(key);
                },
                onInactive: () => {
                    const entry = this.signals.get(key)?.get();
                    const cacheTime = entry?.cacheTime ?? this.defaultCacheTime;
                    this.scheduleGC(key, cacheTime);
                }
            }));
        }
    }

    delete(key: string): void {
        // console.log(`[Storage] DELETE ${key}`);
        this.signals.delete(key);
        this.cancelGC(key);
    }

    clear(): void {
        this.signals.clear();
        this.gcTimers.forEach(timer => clearTimeout(timer));
        this.gcTimers.clear();
    }

    getAll(): Map<string, CacheEntry> {
        const map = new Map<string, CacheEntry>();
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
            keys: Array.from(this.signals.keys())
        };
    }

    getSnapshot() {
        return this.signals;
    }

    // --- GC Logic ---

    private scheduleGC(key: string, delay: number) {
        if (this.gcTimers.has(key)) {
            clearTimeout(this.gcTimers.get(key)!);
        }
        const timer = setTimeout(() => {
            this.delete(key);
        }, delay);
        this.gcTimers.set(key, timer);
    }

    private cancelGC(key: string) {
        if (this.gcTimers.has(key)) {
            clearTimeout(this.gcTimers.get(key)!);
            this.gcTimers.delete(key);
        }
    }
}
