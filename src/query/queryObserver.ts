import { type QueryClient, type QueryKeyInput, type CacheEntry, type QueryStatus } from './queryClient';
import { type Schema } from './types';
import { type Signal, computed, effect, createSignal, untracked } from '../signals';
import { stableHash, isDeepEqual } from './utils';
import { validateWithSchema } from './plugins/validation';

export interface QueryObserverOptions<T, TData = T> {
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
    select?: (data: T) => TData;
}

export interface QueryObserverResult<TData> {
    data: TData | undefined;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isPending: boolean;
    isFetching: boolean;
    isStale: boolean;
    error: Error | null;
    status: QueryStatus;
    refetch: () => Promise<void>;
}

export class QueryObserver<T, TData = T> {
    private client: QueryClient;

    // Reactive Inputs
    public options$: Signal<QueryObserverOptions<T, TData>>;

    // Reactive Outputs
    public result$: Signal<QueryObserverResult<TData>>;

    // Internal
    private unsubscribe: (() => void) | null = null;
    private gcUnsubscribe: (() => void) | null = null;
    private abortController: AbortController | null = null;
    private intervalParams: { id: ReturnType<typeof setInterval> | null, interval?: number } = { id: null };

    constructor(client: QueryClient, options: QueryObserverOptions<T, TData>) {
        this.client = client;

        // 1. Wrap Options in a Signal
        this.options$ = createSignal(options);

        // 2. Derive Result (The Core 10X Logic)
        // We use a memoized approach to ensure reference stability if data hasn't changed.
        let lastResult: QueryObserverResult<TData> | null = null;

        this.result$ = computed(() => {
            const opts = this.options$.get();
            const queryKey = opts.queryKey;

            const cacheSignal = this.client.getSignal<T>(queryKey);
            const entry = cacheSignal.get();

            const data = entry?.data;
            const status = entry?.status || 'pending';
            const error = entry?.error || null;
            const isFetching = entry?.isFetching || false;

            // Staleness
            const staleTime = opts.staleTime ?? 0;
            const now = Date.now();
            const dataTimestamp = entry?.timestamp;
            const diff = dataTimestamp ? now - dataTimestamp : -1;
            const isTimeStale = dataTimestamp ? diff > staleTime : true;
            const isStale = (entry?.isInvalidated) || isTimeStale;

            const isError = status === 'error';
            const isSuccess = status === 'success';
            const isPending = status === 'pending';
            const isLoading = data === undefined && isFetching;

            // Selector Logic
            let finalData: TData | undefined;
            if (data !== undefined) {
                try {
                    finalData = opts.select ? opts.select(data) : (data as unknown as TData);
                } catch (e) {
                    // 10/10 Safety: Fix crash if lastResult is null on first run
                    return {
                        ...(lastResult ?? {} as QueryObserverResult<TData>),
                        status: 'error',
                        error: e as Error,
                        isError: true
                    };
                }
            }

            const nextResult: QueryObserverResult<TData> = {
                data: finalData,
                isLoading,
                isError,
                isSuccess,
                isPending,
                isFetching,
                isStale,
                error,
                status,
                refetch: this.refetch
            };

            // 10/10 Stability: If nothing meaningful changed, return the EXACT same reference.
            // Replace expensive JSON.stringify with high-performance isDeepEqual.
            const isDataEqual = lastResult?.data === nextResult.data || isDeepEqual(lastResult?.data, nextResult.data);

            if (lastResult &&
                isDataEqual &&
                lastResult.status === nextResult.status &&
                lastResult.isFetching === nextResult.isFetching &&
                lastResult.isStale === nextResult.isStale &&
                lastResult.error === nextResult.error
            ) {
                return lastResult;
            }

            lastResult = nextResult;
            return nextResult;
        });

        // 3. Side Effects (Fetching, Intervals)
        this.initSideEffects();
    }

    setOptions(options: QueryObserverOptions<T, TData>) {
        const current = this.options$.get();

        if (current === options) return;

        // Deep key check + shallow params check
        const isKeyEqual = stableHash(current.queryKey) === stableHash(options.queryKey);
        const isConfigEqual =
            current.enabled === options.enabled &&
            current.staleTime === options.staleTime &&
            current.cacheTime === options.cacheTime &&
            current.refetchInterval === options.refetchInterval &&
            current.retry === options.retry;

        // 10/10 Logic: Even if the function reference changed (inline function), 
        // we only update the signal if the key or core config changed.
        // The 'select' function is accessed inside the computed result$ anyway.
        // If we update options$ on every render due to an inline 'select', we trigger computed.
        // If we DON'T update options$, the computed result$ will still use the OLD 'select' from the signal.

        // Wait: If the user changes the selector logic but keeps the key, they want the new selector.
        // But in React, inline selectors are recreated EVERY render.
        // We should update the signal if the selector reference changed, BUT the computed result$ 
        // should be smart enough not to change ITS reference if the selected data is identical.

        if (!isKeyEqual || !isConfigEqual || current.select !== options.select) {
            this.options$.set(options);
        }
    }

    subscribe(listener: () => void): () => void {
        const unsub = this.result$.subscribe(() => {
            listener();
        });

        // Ensure side effects are running (lazy init if we wanted, but we init in constructor)
        return unsub;
    }

    getSnapshot = () => {
        return this.result$.get();
    }

    private initSideEffects() {
        const disposeEffect = effect(() => {
            const opts = this.options$.get();
            const res = this.result$.get();

            if (opts.enabled !== false) {
                if (res.isLoading && !res.isFetching && !res.isError) {
                    untracked(() => this.fetch());
                }
                else if (res.isStale && !res.isFetching && !res.isError) {
                    untracked(() => this.fetch());
                }
            }
        });

        const disposeGC = effect(() => {
            const opts = this.options$.get();
            const signal = this.client.getSignal<T>(opts.queryKey);
            const unsub = signal.subscribe(() => { });
            return () => unsub();
        });

        this.unsubscribe = () => {
            disposeEffect();
            disposeGC();
        };
    }

    refetch = async () => {
        const opts = this.options$.get();
        this.client.invalidate(opts.queryKey);
        await this.fetch();
    }

    fetch = async (background = false) => {
        const opts = this.options$.get();
        if (opts.enabled === false) return;

        // Abort previous fetch
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            await this.client.fetch(opts.queryKey,
                async (ctx) => {
                    const data = await opts.queryFn(ctx);
                    if (opts.schema) {
                        return validateWithSchema(data, opts.schema);
                    }
                    return data;
                },
                { signal, retry: opts.retry, retryDelay: opts.retryDelay, tags: opts.tags }
            );
        } catch (e) {
            // Client handles error
        }
    }

    destroy() {
        if (this.unsubscribe) this.unsubscribe();
        if (this.abortController) this.abortController.abort();
    }
}

