/**
 * Infinite Query Hook (Reactive)
 * Provides infinite scroll with Signal-based reactivity
 * 
 * Refactored to "Senior Standards":
 * - No local state (useReducer removed)
 * - All state derived from Global QueryCache Signal
 * - Manual signal updates for aggregate key to track fetching state of pages
 */

import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';
import { type InfiniteData } from './types'; // types might be missing if not exported? I'll define inline if needed or re-export
import { getLogger } from './plugins/logger';

// Ensure types are compatible
export interface UseInfiniteQueryOptions<T, TPageParam = any> {
    queryKey: any[];
    queryFn: (context: { pageParam: TPageParam }) => Promise<T>;
    getNextPageParam?: (lastPage: T, allPages: T[]) => TPageParam | undefined;
    getPreviousPageParam?: (firstPage: T, allPages: T[]) => TPageParam | undefined;
    initialPageParam?: TPageParam;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
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
    enabled = true
}: UseInfiniteQueryOptions<T, TPageParam>): InfiniteQueryResult<T> {
    const client = useQueryClient();
    const queryKeyHash = stableHash(queryKey);

    // Cache key for infinite query data
    const infiniteQueryKey = [...queryKey, '__infinite__'];

    // --- EXTERNAL STORE SUBSCRIPTION ---
    const subscribe = useCallback((onStoreChange: () => void) => {
        const signal = client.getSignal<InfiniteData<T>>(infiniteQueryKey);
        return signal.subscribe(() => onStoreChange());
    }, [client, queryKeyHash]);

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
        // If data exists and is fresh, don't fetch
        if (data && (Date.now() - timestamp) <= staleTime) return;
        // Also don't fetch if already fetching (deduplication)
        if (isFetching) return;

        const doInitialFetch = async () => {
            const initialParam = initialPageParamRef.current;
            const firstParam = (initialParam !== undefined ? initialParam : 0) as TPageParam;
            // Key unused for aggregate logic but useful if we wanted to cache page separately
            // const pageKey = [...infiniteQueryKey, 'initial', String(firstParam)];

            try {
                // Use client.fetch on AGGREGATE key directly
                const initialData = await client.fetch(infiniteQueryKey, async () => {
                    const firstPage = await queryFnRef.current({ pageParam: firstParam });
                    return {
                        pages: [firstPage],
                        pageParams: [firstParam]
                    } as InfiniteData<T>;
                }, { fetchDirection: 'initial' });

                // Commit to cache
                client.set(infiniteQueryKey, initialData, {
                    staleTime: staleTimeRef.current,
                    cacheTime: cacheTimeRef.current
                });
            } catch (err) {
                // handled by client.fetch
            }
        };

        doInitialFetch();
    }, [enabled, data === undefined, staleTime]);
    // ^ Modified dependencies: only run if enabled changing, or data availability changing.
    // Simpler check: if data is undefined, fetch. 
    // If data becomes defined (fetch success), this effect runs but check logic returns.
    // If we invalidate (data becomes undefined), it runs again.

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
                return {
                    pages: [...currentData.pages, newPage],
                    pageParams: [...currentData.pageParams, nextPageParam],
                };
            }, {
                fetchDirection: 'next'
            });

            // Commit to cache
            client.set(infiniteQueryKey, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
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
            }, { fetchDirection: 'previous' });

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
