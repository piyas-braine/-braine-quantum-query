/**
 * Infinite Query Hook (Reactive)
 * Provides infinite scroll with Signal-based reactivity
 * 
 * Refactored to "Senior Standards":
 * - No local state (useReducer removed)
 * - All state derived from Global QueryCache Signal
 * - Manual signal updates for aggregate key to track fetching state of pages
 */

import { useEffect, useCallback, useRef, useSyncExternalStore, useMemo } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';
import { type InfiniteData } from './types'; // types might be missing if not exported? I'll define inline if needed or re-export
import { getLogger } from './plugins/logger';

// Ensure types are compatible
export interface UseInfiniteQueryOptions<T, TPageParam = any> {
    queryKey: unknown[];
    queryFn: (context: { pageParam: TPageParam }) => Promise<T>;
    getNextPageParam?: (lastPage: T, allPages: T[]) => TPageParam | undefined;
    getPreviousPageParam?: (firstPage: T, allPages: T[]) => TPageParam | undefined;
    initialPageParam?: TPageParam;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    retry?: number | boolean;
}

export interface InfiniteQueryResult<T> {
    data: InfiniteData<T> | undefined;
    fetchNextPage: () => Promise<void>;
    fetchPreviousPage: () => Promise<void>;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useInfiniteQuery<T, TPageParam = any>({
    queryKey,
    queryFn,
    getNextPageParam,
    getPreviousPageParam,
    initialPageParam,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    enabled = true,
    retry
}: UseInfiniteQueryOptions<T, TPageParam>): InfiniteQueryResult<T> {
    const client = useQueryClient();
    const queryKeyHash = stableHash(queryKey);

    // Cache key for infinite query data - Memoized stability
    const infiniteQueryKey = useMemo(() => [...queryKey, '__infinite__'], [queryKeyHash]);

    // --- EXTERNAL STORE SUBSCRIPTION ---
    const subscribe = useCallback((onStoreChange: () => void) => {
        const signal = client.getSignal<InfiniteData<T>>(infiniteQueryKey);
        return signal.subscribe(() => onStoreChange());
    }, [client, infiniteQueryKey]); // Depend on the specific key object (memoized)

    const getSnapshot = useCallback(() => {
        const signal = client.getSignal<InfiniteData<T>>(infiniteQueryKey);
        return signal.get();
    }, [client, queryKeyHash]);

    // Read full state from external store
    const cacheEntry = useSyncExternalStore(subscribe, getSnapshot);
    const data = cacheEntry?.data;
    const isFetching = cacheEntry?.isFetching || false;
    const fetchDirection = cacheEntry?.fetchDirection || 'idle';
    const status = cacheEntry?.status || 'pending';
    const error = cacheEntry?.error || null;
    const timestamp = cacheEntry?.timestamp || 0;
    const isInvalidated = cacheEntry?.isInvalidated || false;

    // --- DERIVED STATE (Reactive) ---
    // Calculate hasNext/Previous every render based on LATEST data
    // This is "computed" derived state.
    let hasNextPage = false;
    let hasPreviousPage = false;
    if (data && data.pages.length > 0) {
        if (getNextPageParam) {
            const lastPage = data.pages[data.pages.length - 1]!;
            hasNextPage = getNextPageParam(lastPage, data.pages) !== undefined;
        }
        if (getPreviousPageParam) {
            const firstPage = data.pages[0]!;
            hasPreviousPage = getPreviousPageParam(firstPage, data.pages) !== undefined;
        }
    }

    const isFetchingNextPage = isFetching && fetchDirection === 'next';
    const isFetchingPreviousPage = isFetching && fetchDirection === 'previous';
    const isLoading = data === undefined && isFetching;
    const isError = status === 'error';

    // --- STABLE REFS ---
    const queryFnRef = useRef(queryFn);
    const getNextPageParamRef = useRef(getNextPageParam);
    const getPreviousPageParamRef = useRef(getPreviousPageParam);
    const initialPageParamRef = useRef(initialPageParam);
    const staleTimeRef = useRef(staleTime);
    const cacheTimeRef = useRef(cacheTime);

    useEffect(() => {
        queryFnRef.current = queryFn;
        getNextPageParamRef.current = getNextPageParam;
        getPreviousPageParamRef.current = getPreviousPageParam;
        initialPageParamRef.current = initialPageParam;
        staleTimeRef.current = staleTime;
        cacheTimeRef.current = cacheTime;
    });

    // --- FETCH LOGIC ---

    // Initial Fetch Effect
    useEffect(() => {
        if (!enabled) return;

        // Check staleness
        // If data exists, is fresh, AND not invalidated, don't fetch
        if (data && !isInvalidated && (Date.now() - timestamp) <= staleTime) return;

        // Also don't fetch if already fetching (deduplication)
        if (isFetching) return;

        const doInitialFetch = async () => {
            try {
                // If we have existing data (revalidation/refetch), we try to fetch all pages again
                // to preserve the list state, but we MUST follow the new chain constraints.
                if (data && data.pageParams.length > 0) {
                    const updatedPages: T[] = [];
                    const updatedParams: TPageParam[] = [];

                    // Start with the first param from the *new* context (or reuse initial)
                    // But usually for infinite query, we assume initialParam is static or we use the cached first param?
                    // We use the cached first param to start the chain.
                    let param = data.pageParams[0];
                    updatedParams.push(param as TPageParam);

                    const limit = data.pages.length;

                    const fetchedData = await client.fetch(infiniteQueryKey, async () => {
                        for (let i = 0; i < limit; i++) {
                            const page = await queryFnRef.current({ pageParam: param as TPageParam });
                            updatedPages.push(page);

                            // If we are at the limit, we don't need the next param for fetching *now*,
                            // but we might need it for the *state*? 
                            // Usually pageParams includes the param used to fetch the page.
                            // The logic says: pageParams[i] corresponds to pages[i].

                            if (i < limit - 1) {
                                const next = getNextPageParamRef.current?.(page, updatedPages);
                                if (next === undefined) break; // Chain ended early
                                param = next;
                                updatedParams.push(param as TPageParam);
                            }
                        }

                        return {
                            pages: updatedPages,
                            pageParams: updatedParams
                        };
                    }, { fetchDirection: 'initial', retry });

                    // We need to commit using the result from fetch? 
                    // client.fetch returns the result of the callback.
                    // But we want to ensure we commit it to the store.
                    // Since we perform the fetch inside the wrapper, we can just use the variables.

                    // Re-read updatedPages/Params in case they were modified? No.

                    client.set(infiniteQueryKey, fetchedData, {
                        staleTime: staleTimeRef.current,
                        cacheTime: cacheTimeRef.current
                    });
                    return;
                }

                // Normal Initial Fetch (First page only)
                const initialParam = initialPageParamRef.current;
                const firstParam = (initialParam !== undefined ? initialParam : 0) as TPageParam;

                const initialData = await client.fetch(infiniteQueryKey, async () => {
                    const firstPage = await queryFnRef.current({ pageParam: firstParam });
                    return {
                        pages: [firstPage],
                        pageParams: [firstParam]
                    } as InfiniteData<T>;
                }, { fetchDirection: 'initial', retry });

                // Commit to cache
                client.set(infiniteQueryKey, initialData, {
                    staleTime: staleTimeRef.current,
                    cacheTime: cacheTimeRef.current
                });
            } catch (err) {
                // handled by client.fetch
                getLogger().error("Initial fetch failed", err);
            }
        };

        doInitialFetch();
    }, [enabled, data === undefined, isInvalidated, staleTime, timestamp]);

    const fetchNextPage = useCallback(async () => {
        if (!hasNextPage || isFetching || !data) return;

        const lastPage = data.pages[data.pages.length - 1]!;
        const nextPageParam = getNextPageParamRef.current?.(lastPage, data.pages);
        if (nextPageParam === undefined) return;

        // Use client.fetch to manage state lifecycle automatically
        // We wrap the page fetch + merge into a single async operation associated with the AGGREGATE key
        try {
            const updatedData = await client.fetch(infiniteQueryKey, async ({ signal }) => {
                // 1. Fetch the new page
                // call queryFn directly
                const newPage = await queryFnRef.current({ pageParam: nextPageParam });

                // 2. Get latest data to merge
                // We read directly from signal to avoid closure staleness
                const currentEntry = client.getSignal<InfiniteData<T>>(infiniteQueryKey).get();
                const currentData = currentEntry?.data;

                if (!currentData) throw new Error("Infinite query data missing during fetchNextPage");

                // 3. Return merged data
                const nextCursor = getNextPageParamRef.current?.(newPage, [...currentData.pages, newPage]);
                const updatedParams = [...currentData.pageParams, nextPageParam];
                if (nextCursor !== undefined) {
                    updatedParams.push(nextCursor as any); // Cast to any to satisfy flexible TPageParam
                }

                return {
                    pages: [...currentData.pages, newPage],
                    pageParams: updatedParams,
                };
            }, {
                fetchDirection: 'next',
                retry
            });

            // Commit to cache

            // Critical Fix: Ensure we are not throttled by React state updates
            // Force the update to the store immediately.
            client.set(infiniteQueryKey, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });

            // Re-eval hasNextPage? 
            // The hook will re-render because it subscribes to the signal.

        } catch (err) {
            // client.fetch handles setting error state
            getLogger().error("Fetch next page failed", err);
        }
    }, [hasNextPage, isFetching, data, client, JSON.stringify(infiniteQueryKey)]);

    const fetchPreviousPage = useCallback(async () => {
        if (!hasPreviousPage || isFetching || !data) return;

        const firstPage = data.pages[0]!;
        const previousPageParam = getPreviousPageParamRef.current?.(firstPage, data.pages);
        if (previousPageParam === undefined) return;

        try {
            const updatedData = await client.fetch(infiniteQueryKey, async () => {
                const newPage = await queryFnRef.current({ pageParam: previousPageParam });
                const currentEntry = client.getSignal<InfiniteData<T>>(infiniteQueryKey).get();
                const currentData = currentEntry?.data;

                if (!currentData) throw new Error("Infinite query data missing during fetchPreviousPage");

                return {
                    pages: [newPage, ...currentData.pages],
                    pageParams: [previousPageParam, ...currentData.pageParams],
                };
            }, { fetchDirection: 'previous', retry });

            // Commit
            client.set(infiniteQueryKey, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
        } catch (err) {
            // Handled by client.fetch
            getLogger().error("Fetch previous page failed", err);
        }
    }, [hasPreviousPage, isFetching, data, client, JSON.stringify(infiniteQueryKey)]);

    const refetch = useCallback(async () => {
        client.invalidate(infiniteQueryKey);
    }, [client, JSON.stringify(infiniteQueryKey)]);

    return {
        data,
        fetchNextPage,
        fetchPreviousPage,
        hasNextPage,
        hasPreviousPage,
        isFetching,
        isFetchingNextPage,
        isFetchingPreviousPage,
        isLoading,
        isError,
        error,
        refetch
    };
}
