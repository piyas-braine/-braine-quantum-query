/**
 * Pagination Hook
 * Provides offset-based and cursor-based pagination
 */

// ... imports
import { useState, useEffect, useCallback, useRef } from 'react';
import { queryCache } from './queryCache';

export interface UsePaginatedQueryOptions<T> {
    queryKey: string[];
    queryFn: (page: number) => Promise<T>;
    pageSize?: number;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
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
    enabled = true
}: UsePaginatedQueryOptions<T>): PaginatedQueryResult<T> {
    const [page, setPage] = useState(0);
    const [data, setData] = useState<T | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasNext, setHasNext] = useState(true);

    // Stable usage of queryFn
    const queryFnRef = useRef(queryFn);
    useEffect(() => {
        queryFnRef.current = queryFn;
    });

    // Stable query key hash
    const queryKeyHash = JSON.stringify(queryKey);

    const fetchPage = useCallback(async (pageNum: number) => {
        if (!enabled) return;

        const pageQueryKey = [...queryKey, 'page', pageNum];

        // Check cache first
        const cached = queryCache.get<T>(pageQueryKey);
        if (cached && !queryCache.isStale(pageQueryKey)) {
            setData(cached);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);

            const result = await queryFnRef.current(pageNum);

            // Cache the result
            queryCache.set(pageQueryKey, result, { staleTime, cacheTime });

            setData(result);

            // Detect if there's a next page (heuristic: if we got less than pageSize, no next page)
            if (Array.isArray(result)) {
                setHasNext(result.length === pageSize);
            } else if (result && typeof result === 'object' && 'hasMore' in result) {
                setHasNext((result as any).hasMore);
            }

            setIsLoading(false);
        } catch (err) {
            setIsError(true);
            setError(err as Error);
            setIsLoading(false);
        }
    }, [queryKeyHash, enabled, pageSize, staleTime, cacheTime]); // Stable deps

    // Fetch data when page or enabled changes
    useEffect(() => {
        fetchPage(page);
    }, [page, fetchPage]); // fetchPage is stable if enabled/pageSize/staleTime/cacheTime/queryKeyHash are stable

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
        // Invalidate cache and refetch
        queryCache.invalidate([...queryKey, 'page', String(page)]);
        await fetchPage(page);
    }, [queryKeyHash, page, fetchPage]);

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
        hasPrevious: page > 0,
        refetch
    };
}
