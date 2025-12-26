import { type QueryClient, type QueryKeyInput, type CacheEntry, type QueryStatus } from './queryClient';
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
    retry?: number | boolean;
    retryDelay?: number | ((attemptIndex: number) => number);
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
    private client: QueryClient;
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

    constructor(client: QueryClient, options: QueryObserverOptions<T>) {
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

    private computeResult(): QueryObserverResult<T> {
        const entry = this.signal.get();

        const data = entry?.data;
        const status = entry?.status || 'pending';
        const error = entry?.error || null;
        const isFetching = entry?.isFetching || false;
        const dataTimestamp = entry?.timestamp;

        const staleTime = this.options.staleTime ?? 0;
        const now = Date.now();
        const diff = dataTimestamp ? now - dataTimestamp : -1;
        const isTimeStale = dataTimestamp ? diff > staleTime : true;



        const isStale = (entry?.isInvalidated) || isTimeStale;
        const isError = status === 'error';
        const isLoading = data === undefined;

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

        // Stability Check
        if (this.currentResult && this.shallowEqual(this.currentResult, nextResult)) {
            return this.currentResult;
        }

        this.currentResult = nextResult;
        return nextResult;
    }

    getSnapshot = (): QueryObserverResult<T> => {
        // If we don't have a result yet, compute it.
        // Subsequent reads should ideally return the cached 'currentResult'
        // UNLESS the signal has changed?
        // useSyncExternalStore calls subscribe, then getSnapshot.
        // If signal changes, we call notify(), which triggers React to call getSnapshot again.
        // So getSnapshot SHOULD re-compute if needed.
        // But to be safe and ensure stability during render phase:
        if (!this.currentResult) {
            return this.computeResult();
        }
        return this.currentResult;
    }

    private shallowEqual(objA: unknown, objB: unknown) {
        if (Object.is(objA, objB)) return true;

        if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) return false;

        const recordA = objA as Record<string, unknown>;
        const recordB = objB as Record<string, unknown>;

        const keysA = Object.keys(recordA);
        const keysB = Object.keys(recordB);

        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(recordB, key) || !Object.is(recordA[key], recordB[key])) {
                return false;
            }
        }
        return true;
    }

    private notify() {
        // Pre-compute the new result so getSnapshot returns the fresh one immediately
        this.computeResult();

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
                { signal, retry: this.options.retry, retryDelay: this.options.retryDelay }
            );

            // Validation via Plugin
            try {
                result = validateWithSchema(result, this.options.schema);
            } catch (validationErr) {
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

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            // client.fetch handles error state updates
            if (err instanceof Error && err.name !== 'AbortError') {
                // Potentially log unexpected errors that aren't handling by client.fetch if needed, 
                // but client.fetch generally handles the signal update.
            }
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
        else if (snapshot.isStale && !snapshot.isFetching && !snapshot.isError) {
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
