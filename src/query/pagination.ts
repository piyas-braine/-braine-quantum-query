/**
 * Pagination Hook
 * Provides offset-based and cursor-based pagination
 */

// ... imports
// ... imports
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from './context';

export interface UsePaginatedQueryOptions<T> {
    queryKey: string[];
    queryFn: (page: number) => Promise<T>;
    pageSize?: number;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    retry?: number | boolean;
}

export interface PaginatedQueryResult<T> {
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    page: number;
    setPage: (page: number) => void;
    nextPage: () => void;
    previousPage: () => void;
    hasNext: boolean;
    hasPrevious: boolean;
    refetch: () => Promise<void>;
}

export function usePaginatedQuery<T>({
    queryKey,
    queryFn,
    pageSize = 20,
    staleTime,
    cacheTime,
    enabled = true,
    retry
}: UsePaginatedQueryOptions<T>): PaginatedQueryResult<T> {
    const client = useQueryClient();
    const [page, setPage] = useState(0);

    // Current page key
    const pageQueryKey = [...queryKey, 'page', page];
    const pageQueryKeyHash = JSON.stringify(pageQueryKey);

    // --- EXTERNAL STORE SUBSCRIPTION ---
    const subscribe = useCallback((onStoreChange: () => void) => {
        const signal = client.getSignal<T>(pageQueryKey);
        return signal.subscribe(() => onStoreChange());
    }, [client, pageQueryKeyHash]);

    const getSnapshot = useCallback(() => {
        const signal = client.getSignal<T>(pageQueryKey);
        return signal.get();
    }, [client, pageQueryKeyHash]);

    const cacheEntry = useSyncExternalStore(subscribe, getSnapshot);
    const data = cacheEntry?.data;
    const status = cacheEntry?.status || 'pending';
    const error = cacheEntry?.error || null;
    const isFetching = cacheEntry?.isFetching || false;
    const dataTimestamp = cacheEntry?.timestamp;

    // --- DERIVED STATE ---
    const isError = status === 'error';
    // Loading if no data and fetching (or pending execution)
    const isLoading = data === undefined && (isFetching || status === 'pending');

    // Derived hasNext
    let hasNext = true;
    if (data) {
        if (Array.isArray(data)) {
            hasNext = data.length === pageSize;
        } else if (typeof data === 'object' && 'hasMore' in data) {
            hasNext = !!(data as Record<string, unknown>).hasMore;
        }
    }
    const hasPrevious = page > 0;

    // --- STABLE REFS ---
    const queryFnRef = useRef(queryFn);
    const staleTimeRef = useRef(staleTime);
    const cacheTimeRef = useRef(cacheTime);

    useEffect(() => {
        queryFnRef.current = queryFn;
        staleTimeRef.current = staleTime;
        cacheTimeRef.current = cacheTime;
    });

    // --- FETCH LOGIC ---
    const fetchPage = useCallback(async (background = false) => {
        if (!enabled) return;

        // Check freshness locally if not forced
        if (!background) {
            const currentEntry = getSnapshot();
            if (currentEntry && (Date.now() - currentEntry.timestamp) <= (staleTimeRef.current || 0)) {
                return;
            }
        }

        try {
            // client.fetch handles signal update (isFetching=true) and error
            const result = await client.fetch(pageQueryKey, async () => {
                return await queryFnRef.current(page);
            }, { retry });

            // Update Cache
            client.set(pageQueryKey, result as T, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
        } catch (err) {
            // Error handled by client.fetch (sets signal status='error')
        }
    }, [pageQueryKeyHash, enabled, client, getSnapshot, page]); // Stable deps

    // Fetch on mount or page change
    useEffect(() => {
        if (enabled) {
            fetchPage();
        }
    }, [fetchPage, enabled]);

    const nextPage = useCallback(() => {
        if (hasNext) {
            setPage(p => p + 1);
        }
    }, [hasNext]);

    const previousPage = useCallback(() => {
        if (page > 0) {
            setPage(p => p - 1);
        }
    }, [page]);

    const refetch = useCallback(async () => {
        client.invalidate(pageQueryKey);
        await fetchPage();
    }, [pageQueryKeyHash, fetchPage, client]);

    return {
        data,
        isLoading,
        isError,
        error,
        page,
        setPage,
        nextPage,
        previousPage,
        hasNext,
        hasPrevious,
        refetch
    };
}
