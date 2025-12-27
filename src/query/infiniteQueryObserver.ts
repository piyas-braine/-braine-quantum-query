import { QueryClient, type CacheEntry, type FetchDirection } from './queryClient';
import { type InfiniteData } from './types';
import { type Signal, createSignal, computed, effect, untracked } from '../signals';
import { stableHash, isDeepEqual } from './utils';
import { getLogger } from './plugins/logger';
import { focusManager } from './focusManager';
import { onlineManager } from './onlineManager';

export interface InfiniteQueryObserverOptions<T, TPageParam = unknown> {
    queryKey: unknown[];
    queryFn: (context: { pageParam: TPageParam }) => Promise<T>;
    getNextPageParam?: (lastPage: T, allPages: T[]) => TPageParam | undefined;
    getPreviousPageParam?: (firstPage: T, allPages: T[]) => TPageParam | undefined;
    initialPageParam?: TPageParam;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    retry?: number | boolean;
}

export interface InfiniteQueryObserverResult<T> {
    data: InfiniteData<T> | undefined;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
    isLoading: boolean;
    isError: boolean;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    error: Error | null;
    status: 'pending' | 'success' | 'error';
    fetchNextPage: () => Promise<void>;
    fetchPreviousPage: () => Promise<void>;
    refetch: () => Promise<void>;
}

export class InfiniteQueryObserver<T, TPageParam = unknown> {
    private client: QueryClient;
    public options$: Signal<InfiniteQueryObserverOptions<T, TPageParam>>;
    public result$: Signal<InfiniteQueryObserverResult<T>>;
    private unsubscribe: (() => void) | null = null;
    private lastFetchTime = 0;

    constructor(client: QueryClient, options: InfiniteQueryObserverOptions<T, TPageParam>) {
        this.client = client;
        this.options$ = createSignal(options);

        const infiniteQueryKey = computed(() => {
            const opts = this.options$.get();
            return [...opts.queryKey, '__infinite__'];
        });

        let lastResult: InfiniteQueryObserverResult<T> | null = null;

        this.result$ = computed(() => {
            const opts = this.options$.get();
            const key = infiniteQueryKey.get();
            const cacheSignal = this.client.getSignal<InfiniteData<T>>(key);
            const entry = cacheSignal.get();

            const data = entry?.data;
            const isFetching = entry?.isFetching || false;
            const fetchDirection = entry?.fetchDirection || 'idle';
            const status = entry?.status || 'pending';
            const error = entry?.error || null;

            let hasNextPage = false;
            let hasPreviousPage = false;
            if (data && data.pages.length > 0) {
                if (opts.getNextPageParam) {
                    const lastPage = data.pages[data.pages.length - 1];
                    if (lastPage) {
                        hasNextPage = opts.getNextPageParam(lastPage, data.pages) !== undefined;
                    }
                }
                if (opts.getPreviousPageParam) {
                    const firstPage = data.pages[0];
                    if (firstPage) {
                        hasPreviousPage = opts.getPreviousPageParam(firstPage, data.pages) !== undefined;
                    }
                }
            }

            const isFetchingNextPage = isFetching && fetchDirection === 'next';
            const isFetchingPreviousPage = isFetching && fetchDirection === 'previous';
            const isLoading = data === undefined && isFetching;

            const nextResult: InfiniteQueryObserverResult<T> = {
                data,
                isFetching,
                isFetchingNextPage,
                isFetchingPreviousPage,
                isLoading,
                isError: status === 'error',
                hasNextPage,
                hasPreviousPage,
                error,
                status,
                fetchNextPage: this.fetchNextPage,
                fetchPreviousPage: this.fetchPreviousPage,
                refetch: this.refetch
            };

            // 10/10 Stability: Reference check for complex nested data (InfiniteData)
            // Replace expensive JSON.stringify with high-performance isDeepEqual.
            const isDataEqual = lastResult?.data === nextResult.data || isDeepEqual(lastResult?.data, nextResult.data);

            if (lastResult &&
                isDataEqual &&
                lastResult.isFetching === nextResult.isFetching &&
                lastResult.status === nextResult.status &&
                lastResult.hasNextPage === nextResult.hasNextPage &&
                lastResult.hasPreviousPage === nextResult.hasPreviousPage
            ) {
                return lastResult;
            }

            lastResult = nextResult;
            return nextResult;
        });

        this.initSideEffects();
    }

    setOptions(options: InfiniteQueryObserverOptions<T, TPageParam>) {
        const current = this.options$.get();
        if (current === options) return;

        const isKeyEqual = stableHash(current.queryKey) === stableHash(options.queryKey);
        const isConfigEqual =
            current.enabled === options.enabled &&
            current.staleTime === options.staleTime;

        // Only update signal if core inputs changed. 
        // queryFn/getParams are handled inside side-effects/computed via untracked or reactive pulls.
        if (!isKeyEqual || !isConfigEqual ||
            current.getNextPageParam !== options.getNextPageParam ||
            current.getPreviousPageParam !== options.getPreviousPageParam
        ) {
            this.options$.set(options);
        }
    }

    private initSideEffects() {
        const dispose = effect(() => {
            const opts = this.options$.get();
            const res = this.result$.get();

            if (opts.enabled !== false) {
                const infiniteKey = [...opts.queryKey, '__infinite__'];
                const entry = this.client.getSignal<InfiniteData<T>>(infiniteKey).get();

                const staleTime = opts.staleTime ?? 0;
                const now = Date.now();
                const timestamp = entry?.timestamp || 0;
                const isStale = entry?.isInvalidated || (entry?.data && (now - timestamp) > staleTime);

                // 10/10 Logic: Prevent refetching if we are already fetching (any direction)
                // or if there is an error.
                if ((!entry?.data || isStale) && !res.isFetching && !res.isError) {
                    untracked(() => this.fetchInitial());
                }
            }
        });

        const disposeFocus = focusManager.subscribe(() => {
            const opts = this.options$.get();
            if (opts.enabled !== false && opts.refetchOnWindowFocus !== false) {
                this.fetchInitial();
            }
        });

        const disposeOnline = onlineManager.subscribe((isOnline) => {
            const opts = this.options$.get();
            if (isOnline && opts.enabled !== false && opts.refetchOnReconnect !== false) {
                this.fetchInitial();
            }
        });

        this.unsubscribe = () => {
            dispose();
            disposeFocus();
            disposeOnline();
        };
    }

    fetchInitial = async (options?: { force?: boolean }) => {
        const opts = this.options$.get();
        const infiniteKey = [...opts.queryKey, '__infinite__'];

        try {
            const entrySignal = this.client.getSignal<InfiniteData<T>>(infiniteKey);
            const data = entrySignal.get()?.data;

            if (data && data.pageParams.length > 0 && !options?.force) {
                // 10/10 Logic: Background refetch should NOT reset the data.
                // We refetch the first page and merge it with the existing page list.
                const firstParam = data.pageParams[0];
                const firstPage = await opts.queryFn({ pageParam: firstParam as TPageParam });

                const latest = entrySignal.get()?.data;
                if (!latest) return;

                const updatedData = {
                    ...latest,
                    pages: [firstPage, ...latest.pages.slice(1)],
                };

                this.client.set(infiniteKey, updatedData, {
                    staleTime: opts.staleTime,
                    cacheTime: opts.cacheTime
                });
                return;
            }

            const initialParam = opts.initialPageParam;
            const firstParam = (initialParam !== undefined ? initialParam : 0) as TPageParam;

            const initialData = await this.client.fetch(infiniteKey, async () => {
                const firstPage = await opts.queryFn({ pageParam: firstParam });
                return {
                    pages: [firstPage],
                    pageParams: [firstParam]
                } as InfiniteData<T>;
            }, { fetchDirection: 'initial', retry: opts.retry });

            this.client.set(infiniteKey, initialData, {
                staleTime: opts.staleTime,
                cacheTime: opts.cacheTime
            });
        } catch (err) {
            getLogger().error("Initial fetch failed", err);
        }
    }

    fetchNextPage = async () => {
        const res = this.result$.get();
        const opts = this.options$.get();
        if (!res.hasNextPage || res.isFetching || !res.data) return;

        const infiniteKey = [...opts.queryKey, '__infinite__'];
        const lastPage = res.data.pages[res.data.pages.length - 1];
        if (!lastPage) {
            return;
        }
        const nextPageParam = opts.getNextPageParam?.(lastPage, res.data.pages);
        if (nextPageParam === undefined) return;

        try {
            const updatedData = await this.client.fetch(infiniteKey, async () => {
                const newPage = await opts.queryFn({ pageParam: nextPageParam });
                const currentData = this.client.getSignal<InfiniteData<T>>(infiniteKey).get()?.data;
                if (!currentData) throw new Error("Infinite query data missing");

                const updatedParams = [...currentData.pageParams, nextPageParam];
                const nextCursor = opts.getNextPageParam?.(newPage, [...currentData.pages, newPage]);
                if (nextCursor !== undefined) {
                    updatedParams.push(nextCursor as TPageParam);
                }

                return {
                    pages: [...currentData.pages, newPage],
                    pageParams: updatedParams,
                };
            }, { fetchDirection: 'next', retry: opts.retry });

            this.client.set(infiniteKey, updatedData, {
                staleTime: opts.staleTime,
                cacheTime: opts.cacheTime
            });
        } catch (err) {
            getLogger().error("Fetch next page failed", err);
        }
    }

    fetchPreviousPage = async () => {
        const res = this.result$.get();
        const opts = this.options$.get();
        if (!res.hasPreviousPage || res.isFetching || !res.data) return;

        const infiniteKey = [...opts.queryKey, '__infinite__'];
        const firstPage = res.data.pages[0];
        if (!firstPage) {
            return;
        }
        const previousPageParam = opts.getPreviousPageParam?.(firstPage, res.data.pages);
        if (previousPageParam === undefined) return;

        try {
            const updatedData = await this.client.fetch(infiniteKey, async () => {
                const newPage = await opts.queryFn({ pageParam: previousPageParam });
                const currentData = this.client.getSignal<InfiniteData<T>>(infiniteKey).get()?.data;
                if (!currentData) throw new Error("Infinite query data missing");

                return {
                    pages: [newPage, ...currentData.pages],
                    pageParams: [previousPageParam, ...currentData.pageParams],
                };
            }, { fetchDirection: 'previous', retry: opts.retry });

            this.client.set(infiniteKey, updatedData, {
                staleTime: opts.staleTime,
                cacheTime: opts.cacheTime
            });
        } catch (err) {
            getLogger().error("Fetch previous page failed", err);
        }
    }

    refetch = async () => {
        const opts = this.options$.get();
        const infiniteKey = [...opts.queryKey, '__infinite__'];
        this.client.invalidate(infiniteKey);
        await this.fetchInitial({ force: true });
    }

    destroy() {
        if (this.unsubscribe) this.unsubscribe();
    }
}
