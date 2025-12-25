/**
 * useQuery Hook
 * Base query hook with stale-while-revalidate and background refetching
 */

import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';

export interface UseQueryOptions<T> {
    queryKey: any[];
    queryFn: () => Promise<T>;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    refetchInterval?: number;
}

export interface QueryResult<T> {
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    isStale: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useQuery<T>({
    queryKey,
    queryFn,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    enabled = true,
    refetchOnWindowFocus = false,
    refetchOnReconnect = false,
    refetchInterval
}: UseQueryOptions<T>): QueryResult<T> {
    const client = useQueryClient();
    const [state, dispatch] = useReducer(reducer, initialState);

    const abortControllerRef = useRef<AbortController | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Stable query key hash
    const queryKeyHash = stableHash(queryKey);

    const fetchData = useCallback(async (background = false) => {
        if (!enabled) return;

        // Cancel any ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        // Check cache first
        const cached = client.get<T>(queryKey);
        if (cached) {
            const stale = client.isStale(queryKey);

            // If we have cached data, update state immediately
            // If it's stale, we'll continue to fetch
            if (!background) {
                dispatch({
                    type: 'CACHE_HIT',
                    data: cached,
                    isStale: stale
                });
            }

            // If valid and not background fetch, we are done
            if (!stale && !background) {
                return;
            }
        }

        try {
            dispatch({ type: 'FETCH_START', background });

            const result = await queryFn();

            // Cache the result
            client.set(queryKey, result, { staleTime, cacheTime });

            dispatch({ type: 'FETCH_SUCCESS', data: result });
        } catch (err: any) {
            // Ignore abort errors
            if (err.name === 'AbortError') return;

            dispatch({ type: 'FETCH_ERROR', error: err });
        }
    }, [queryKeyHash, queryFn, enabled, staleTime, cacheTime, client]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Refetch interval
    useEffect(() => {
        if (!enabled || !refetchInterval) return;

        intervalRef.current = setInterval(() => {
            fetchData(true);
        }, refetchInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, refetchInterval, fetchData]);

    // Window focus refetch
    useEffect(() => {
        if (!enabled || !refetchOnWindowFocus) return;

        const handleFocus = () => {
            if (client.isStale(queryKey)) {
                fetchData(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [enabled, refetchOnWindowFocus, queryKey, fetchData, client]);

    // Network reconnect refetch
    useEffect(() => {
        if (!enabled || !refetchOnReconnect) return;

        const handleOnline = () => {
            if (client.isStale(queryKey)) {
                fetchData(true);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enabled, refetchOnReconnect, queryKey, fetchData, client]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const refetch = useCallback(async () => {
        client.invalidate(queryKey);
        await fetchData();
    }, [queryKeyHash, fetchData, client]);

    return {
        data: state.data,
        isLoading: state.isLoading,
        isError: state.isError,
        isFetching: state.isFetching,
        isStale: state.isStale,
        error: state.error,
        refetch
    };
}

// --- Reducer ---

interface State<T> {
    data: T | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    isStale: boolean;
    error: Error | null;
}

const initialState: State<any> = {
    data: undefined,
    isLoading: true,
    isFetching: false,
    isError: false,
    isStale: false,
    error: null,
};

type Action<T> =
    | { type: 'FETCH_START'; background: boolean }
    | { type: 'FETCH_SUCCESS'; data: T }
    | { type: 'FETCH_ERROR'; error: Error }
    | { type: 'CACHE_HIT'; data: T; isStale: boolean };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case 'FETCH_START':
            return {
                ...state,
                isLoading: !action.background && !state.data, // Only loading if no data
                isFetching: true,
                isError: false,
                error: null,
            };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isStale: false,
                data: action.data,
                isError: false,
                error: null
            };
        case 'FETCH_ERROR':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isError: true,
                error: action.error,
            };
        case 'CACHE_HIT':
            return {
                ...state,
                isLoading: false,
                data: action.data,
                isStale: action.isStale,
                // Do not clear fetching here, as we might be continuing to fetch if stale
            };
        default:
            return state;
    }
}
