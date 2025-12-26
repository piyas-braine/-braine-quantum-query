import { type QueryCache, type QueryKeyInput, type CacheEntry, type QueryStatus } from './queryCache';
import { type Schema } from './types';
import { type Signal } from '../signals';
import { stableHash } from './utils';
import { validateWithSchema } from './plugins/validation';

export interface QueryObserverOptions<T> {
    queryKey: QueryKeyInput;
    queryFn: (context?: { signal?: AbortSignal }) => Promise<unknown>;
    schema?: Schema<T>;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    refetchInterval?: number;
    tags?: string[];
}

export interface QueryObserverResult<T> {
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    isStale: boolean;
    error: Error | null;
    status: QueryStatus;
    refetch: () => Promise<void>;
}

export class QueryObserver<T> {
    private client: QueryCache;
    private options: QueryObserverOptions<T>;
    private queryKeyHash: string;
    private signal: Signal<CacheEntry<T> | undefined>;
    private listeners = new Set<() => void>();

    // Internal state management
    private abortController: AbortController | null = null;
    private intervalParams: { id: ReturnType<typeof setInterval> | null, interval?: number } = { id: null };
    private unsubscribeSignal: (() => void) | null = null;

    // Derived state cache to ensure referential stability where possible
    private currentResult: QueryObserverResult<T> | undefined;

    constructor(client: QueryCache, options: QueryObserverOptions<T>) {
        this.client = client;
        this.options = options;
        this.queryKeyHash = stableHash(options.queryKey);
        this.signal = client.getSignal<T>(options.queryKey);
    }

    setOptions(options: QueryObserverOptions<T>) {
        const prevOptions = this.options;
        this.options = options;

        const newHash = stableHash(options.queryKey);
        if (newHash !== this.queryKeyHash) {
            this.queryKeyHash = newHash;
            this.updateSignal();
            this.checkAndFetch();
        } else {
            // If enabled changed from false to true, we might need to fetch
            if (options.enabled && !prevOptions.enabled) {
                this.checkAndFetch();
            }
        }

        // Handle interval changes
        if (options.refetchInterval !== prevOptions.refetchInterval) {
            this.setupInterval();
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        // Lazily subscribe to signal if this is the first listener
        if (this.listeners.size === 1) {
            this.init();
        }

        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.destroy();
            }
        };
    }

    private init() {
        this.updateSignal();
        this.setupGlobalListeners();
        this.setupInterval();
        // Initial fetch if needed
        this.checkAndFetch();
    }

    private destroy() {
        this.cleanupGlobalListeners();
        this.cleanupInterval();
        if (this.unsubscribeSignal) {
            this.unsubscribeSignal();
            this.unsubscribeSignal = null;
        }
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    private updateSignal() {
        if (this.unsubscribeSignal) this.unsubscribeSignal();
        this.signal = this.client.getSignal<T>(this.options.queryKey);
        this.unsubscribeSignal = this.signal.subscribe(() => {
            this.notify();
        });
    }

    getSnapshot = (): QueryObserverResult<T> => {
        const entry = this.signal.get();

        const data = entry?.data;
        const status = entry?.status || 'pending';
        const error = entry?.error || null;
        const isFetching = entry?.isFetching || false;
        const dataTimestamp = entry?.timestamp;

        const staleTime = this.options.staleTime ?? 0;
        const isStale = dataTimestamp ? (Date.now() - dataTimestamp) > staleTime : true;
        const isError = status === 'error';
        const isLoading = data === undefined; // Simplified loading definition per our discussion

        const nextResult: QueryObserverResult<T> = {
            data,
            isLoading,
            isError,
            isFetching,
            isStale,
            error,
            status,
            refetch: this.refetch
        };

        if (!this.currentResult) {
            this.currentResult = nextResult;
            return nextResult;
        }

        // Shallow compare to return the same object reference if possible
        if (this.shallowEqual(this.currentResult, nextResult)) {
            return this.currentResult;
        }

        this.currentResult = nextResult;
        return nextResult;
    }

    private shallowEqual(objA: any, objB: any) {
        if (Object.is(objA, objB)) return true;
        if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;

        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(objB, key) || !Object.is(objA[key], objB[key])) {
                return false;
            }
        }
        return true;
    }

    private notify() {
        this.listeners.forEach(l => l());
        this.checkAndFetch();
    }

    // --- Fetch Logic ---

    fetch = async (background = false) => {
        if (this.options.enabled === false) return; // Explicit check for disabled

        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            // Note: client.fetch handles deduplication and signal state updates (isFetching=true)
            let result = await this.client.fetch(this.options.queryKey,
                (ctx) => this.options.queryFn(ctx),
                { signal }
            );

            // Validation via Plugin
            try {
                result = validateWithSchema(result, this.options.schema);
            } catch (validationErr) {
                this.client.set(this.options.queryKey, undefined as T, {
                    staleTime: this.options.staleTime,
                    cacheTime: this.options.cacheTime
                });
                // Force error state on signal
                const current = this.signal.get();
                this.signal.set({
                    ...current!,
                    status: 'error',
                    error: validationErr as Error,
                    isFetching: false,
                    data: undefined
                });
                return;
            }

            // Success commit
            this.client.set(this.options.queryKey, result as T, {
                staleTime: this.options.staleTime,
                cacheTime: this.options.cacheTime,
                tags: this.options.tags
            });

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            // client.fetch handles error state updates
        }
    }

    private checkAndFetch() {
        if (this.options.enabled === false) return;

        const snapshot = this.getSnapshot();
        // Fetch if loading (no data) and not already fetching
        if (snapshot.isLoading && !snapshot.isFetching && !snapshot.isError) {
            this.fetch();
        }
        // Or if data exists but is stale
        else if (snapshot.isStale && !snapshot.isFetching) {
            this.fetch();
        }
    }

    refetch = async () => {
        this.client.invalidate(this.options.queryKey);
        await this.fetch();
    }

    // --- Background Refetching ---

    private setupInterval() {
        this.cleanupInterval();
        if (this.options.enabled !== false && this.options.refetchInterval) {
            this.intervalParams.id = setInterval(() => {
                this.fetch(true);
            }, this.options.refetchInterval);
        }
    }

    private cleanupInterval() {
        if (this.intervalParams.id) {
            clearInterval(this.intervalParams.id);
            this.intervalParams.id = null;
        }
    }

    private onFocus = () => {
        if (this.options.refetchOnWindowFocus) {
            // Check staleness before forcing fetch?
            const snapshot = this.getSnapshot();
            if (snapshot.isStale && !snapshot.isFetching) {
                this.fetch(true);
            }
        }
    }

    private onOnline = () => {
        if (this.options.refetchOnReconnect) {
            const snapshot = this.getSnapshot();
            if (snapshot.isStale && !snapshot.isFetching) {
                this.fetch(true);
            }
        }
    }

    private setupGlobalListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', this.onFocus);
            window.addEventListener('online', this.onOnline);
        }
    }

    private cleanupGlobalListeners() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('focus', this.onFocus);
            window.removeEventListener('online', this.onOnline);
        }
    }
}
