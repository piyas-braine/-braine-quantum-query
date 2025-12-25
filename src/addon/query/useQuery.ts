/**
 * useQuery Hook
 * Base query hook with stale-while-revalidate and background refetching
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, useReducer } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';
import { type Schema } from './types';

export interface UseQueryOptions<T> {
    queryKey: any[];
    queryFn: () => Promise<unknown>;
    schema?: Schema<T>;
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
    schema,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    enabled = true,
    refetchOnWindowFocus = false,
    refetchOnReconnect = false,
    refetchInterval
}: UseQueryOptions<T>): QueryResult<T> {
    const client = useQueryClient();
    const queryKeyHash = stableHash(queryKey);

    // --- EXTERNAL STORE SUBSCRIPTION (Concurrency Safe) ---
    const subscribe = useCallback((onStoreChange: () => void) => {
        // console.error('DEBUG: subscribe called', queryKeyHash);
        const signal = client.getSignal<T>(queryKey);
        // Subscribe to signal updates
        // Signal emits value, we adapt to void callback for React
        return signal.subscribe(() => {
            // console.error('DEBUG: signal updated', queryKeyHash);
            onStoreChange();
        });
    }, [client, queryKeyHash]);

    const getSnapshot = useCallback(() => {
        // console.error('DEBUG: getSnapshot called', queryKeyHash);
        const signal = client.getSignal<T>(queryKey);
        return signal.get();
    }, [client, queryKeyHash]);

    // Read data safely from external store
    const cacheEntry = useSyncExternalStore(subscribe, getSnapshot);
    const data = cacheEntry?.data;
    const dataTimestamp = cacheEntry?.timestamp;

    // --- LOCAL STATUS STATE ---
    // We only track fetching status and errors locally. Data is strictly from store.

    // Initial State
    const [statusState, dispatch] = useReducer(statusReducer, {
        isFetching: false,
        error: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- DERIVED STATE ---
    const isStale = dataTimestamp ? (Date.now() - dataTimestamp) > staleTime : true;
    const isLoading = data === undefined && statusState.isFetching;
    // Note: isLoading usually means "no data and trying to get it". 
    // If we have no data and NOT fetching (enabled=false), is it loading? UseQuery usually says yes if no data.
    // Let's stick to: No Data = Loading (conceptually), but TanStack splits isLoading vs isPending.
    // We'll define isLoading as: No Data in cache.
    const derivedIsLoading = data === undefined;

    // --- STABLE REFS ---
    // Prevent infinite loops when queryFn is defined inline (new reference every render)
    const queryFnRef = useRef(queryFn);
    const schemaRef = useRef(schema);
    const queryKeyRef = useRef(queryKey);

    useEffect(() => {
        queryFnRef.current = queryFn;
        schemaRef.current = schema;
        queryKeyRef.current = queryKey;
    });

    // --- FETCH LOGIC ---
    const fetchData = useCallback(async (background = false) => {
        if (!enabled) return;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        // Check if we need to fetch (if not background)
        if (!background) {
            const currentEntry = getSnapshot(); // Use the getter we defined
            if (currentEntry && (Date.now() - currentEntry.timestamp) <= staleTime) {
                // Fresh enough, don't fetch
                return;
            }
        }

        try {
            // console.log('DEBUG: FETCH_START', queryKeyHash);
            // Optimization: If already fetching (and not background which forces it?), 
            // maybe we shouldn't dispatch? But client.fetch handles dedupe.
            // Dispatching again causes re-render. 
            // We should only dispatch if not already fetching? 
            // But statusState is local.
            dispatch({ type: 'FETCH_START', background });

            const fn = queryFnRef.current;
            const sc = schemaRef.current;
            const key = queryKeyRef.current;

            let result = await client.fetch(key, async () => {
                let res = await fn();
                if (sc) {
                    res = sc.parse(res);
                }
                return res;
            });

            // Update Cache (triggers useSyncExternalStore update)
            // console.log('DEBUG: SETTING CACHE', queryKeyHash);
            client.set(key, result as T, { staleTime, cacheTime });

            dispatch({ type: 'FETCH_SUCCESS' });
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            dispatch({ type: 'FETCH_ERROR', error: err });
        }
    }, [queryKeyHash, enabled, staleTime, cacheTime, client, getSnapshot]); // Removed queryKey (unstable), using ref

    // Initial Fetch & Refetch on Invalidation
    useEffect(() => {
        // If data becomes undefined (e.g. invalidated), we fetch again
        if (data === undefined && !statusState.error) {
            fetchData();
        }
    }, [fetchData, data, statusState.error]);

    // Refetch interval
    useEffect(() => {
        if (!enabled || !refetchInterval) return;
        intervalRef.current = setInterval(() => fetchData(true), refetchInterval);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [enabled, refetchInterval, fetchData]);

    // Window focus
    useEffect(() => {
        if (!enabled || !refetchOnWindowFocus) return;
        const handleFocus = () => {
            // Check staleness via snapshot
            const entry = getSnapshot();
            const isStaleNow = !entry || (Date.now() - entry.timestamp) > staleTime;
            if (isStaleNow) fetchData(true);
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [enabled, refetchOnWindowFocus, fetchData, getSnapshot, staleTime]);

    // Network reconnect
    useEffect(() => {
        if (!enabled || !refetchOnReconnect) return;
        const handleOnline = () => {
            const entry = getSnapshot();
            const isStaleNow = !entry || (Date.now() - entry.timestamp) > staleTime;
            if (isStaleNow) fetchData(true);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enabled, refetchOnReconnect, fetchData, getSnapshot, staleTime]);

    const refetch = useCallback(async () => {
        client.invalidate(queryKey);
        await fetchData();
    }, [queryKeyHash, fetchData, client]);

    return {
        data,
        isLoading: derivedIsLoading,
        isError: !!statusState.error,
        isFetching: statusState.isFetching,
        isStale,
        error: statusState.error,
        refetch
    };
}

// --- REDUCER (Status Only) ---

interface StatusState {
    isFetching: boolean;
    error: Error | null;
}

type StatusAction =
    | { type: 'FETCH_START'; background: boolean }
    | { type: 'FETCH_SUCCESS' }
    | { type: 'FETCH_ERROR'; error: Error };

function statusReducer(state: StatusState, action: StatusAction): StatusState {
    switch (action.type) {
        case 'FETCH_START':
            return {
                ...state,
                isFetching: true,
                error: null,
            };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                isFetching: false,
                error: null
            };
        case 'FETCH_ERROR':
            return {
                ...state,
                isFetching: false,
                error: action.error,
            };
        default:
            return state;
    }
}
