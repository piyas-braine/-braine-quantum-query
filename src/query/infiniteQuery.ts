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
import { type InfiniteData } from './types';
import { getLogger } from './plugins/logger';
import { type CacheEntry } from './queryStorage';

// Ensure types are compatible
export interface UseInfiniteQueryOptions<T, TPageParam = unknown> {
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

export function useInfiniteQuery<T, TPageParam = unknown>({
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
    const lastFetchTimeRef = useRef(0);

    useEffect(() => {
        queryFnRef.current = queryFn;
        getNextPageParamRef.current = getNextPageParam;
        getPreviousPageParamRef.current = getPreviousPageParam;
        initialPageParamRef.current = initialPageParam;
        staleTimeRef.current = staleTime;
        cacheTimeRef.current = cacheTime;
    });

    // --- FETCH LOGIC ---

    const doInitialFetch = useCallback(async () => {
        try {
            // If we have existing data (revalidation/refetch), we try to fetch all pages again
            if (data && data.pageParams.length > 0) {
                const updatedPages: T[] = [];
                const updatedParams: TPageParam[] = [];

                let param = data.pageParams[0];
                updatedParams.push(param as TPageParam);

                const limit = data.pages.length;

                const fetchedData = await client.fetch(infiniteQueryKey, async () => {
                    for (let i = 0; i < limit; i++) {
                        const page = await queryFnRef.current({ pageParam: param as TPageParam });
                        updatedPages.push(page);

                        if (i < limit - 1) {
                            const next = getNextPageParamRef.current?.(page, updatedPages);
                            if (next === undefined) break;
                            param = next;
                            updatedParams.push(param as TPageParam);
                        }
                    }

                    return {
                        pages: updatedPages,
                        pageParams: updatedParams
                    };
                }, { fetchDirection: 'initial', retry });

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

            client.set(infiniteQueryKey, initialData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
        } catch (err) {
            getLogger().error("Initial fetch failed", err);
        }
    }, [client, infiniteQueryKey, retry]);

    // Initial Fetch Effect
    useEffect(() => {
        if (!enabled) return;

        // Check staleness
        const hasData = data !== undefined;
        const isStale = isInvalidated || (hasData && (Date.now() - timestamp) > staleTime);

        if ((!hasData || isStale) && !isFetching) {
            // Anti-loop: If we just fetched in the last 100ms, skip
            if (Date.now() - lastFetchTimeRef.current < 100) return;

            lastFetchTimeRef.current = Date.now();
            doInitialFetch();
        }
    }, [enabled, queryKeyHash, isInvalidated, data === undefined]);

    const fetchNextPage = useCallback(async () => {
        if (!hasNextPage || isFetching || !data) return;

        const lastPage = data.pages[data.pages.length - 1]!;
        const nextPageParam = getNextPageParamRef.current?.(lastPage, data.pages);
        if (nextPageParam === undefined) return;

        try {
            const updatedData = await client.fetch(infiniteQueryKey, async () => {
                const newPage = await queryFnRef.current({ pageParam: nextPageParam });

                const currentEntry = client.getSignal<InfiniteData<T>>(infiniteQueryKey).get();
                const currentData = currentEntry?.data;

                if (!currentData) throw new Error("Infinite query data missing during fetchNextPage");

                const nextCursor = getNextPageParamRef.current?.(newPage, [...currentData.pages, newPage]);
                const updatedParams = [...currentData.pageParams, nextPageParam];
                if (nextCursor !== undefined) {
                    updatedParams.push(nextCursor as TPageParam);
                }

                return {
                    pages: [...currentData.pages, newPage],
                    pageParams: updatedParams,
                };
            }, {
                fetchDirection: 'next',
                retry
            });

            client.set(infiniteQueryKey, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
        } catch (err) {
            getLogger().error("Fetch next page failed", err);
        }
    }, [hasNextPage, isFetching, data, client, infiniteQueryKey, retry]);

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

            client.set(infiniteQueryKey, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
        } catch (err) {
            getLogger().error("Fetch previous page failed", err);
        }
    }, [hasPreviousPage, isFetching, data, client, infiniteQueryKey, retry]);

    const refetch = useCallback(async () => {
        client.invalidate(infiniteQueryKey);
        await doInitialFetch();
    }, [client, infiniteQueryKey, doInitialFetch]);

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

