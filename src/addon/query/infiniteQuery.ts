/**
 * Infinite Query Hook (Reactive)
 * Provides infinite scroll with Signal-based reactivity
 */

import { useEffect, useCallback, useRef, useReducer, useSyncExternalStore } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';

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

export interface InfiniteData<T> {
    pages: T[];
    pageParams: any[];
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

// Status state (local only)
interface StatusState {
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
    error: Error | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

type StatusAction =
    | { type: 'FETCH_START'; direction: 'initial' | 'next' | 'previous' }
    | { type: 'FETCH_SUCCESS'; hasNextPage?: boolean; hasPreviousPage?: boolean }
    | { type: 'FETCH_ERROR'; error: Error }
    | { type: 'SET_PAGINATION'; hasNextPage?: boolean; hasPreviousPage?: boolean };

function statusReducer(state: StatusState, action: StatusAction): StatusState {
    switch (action.type) {
        case 'FETCH_START':
            return {
                ...state,
                isFetching: true,
                isFetchingNextPage: action.direction === 'next',
                isFetchingPreviousPage: action.direction === 'previous',
                error: null,
            };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                isFetching: false,
                isFetchingNextPage: false,
                isFetchingPreviousPage: false,
                hasNextPage: action.hasNextPage !== undefined ? action.hasNextPage : state.hasNextPage,
                hasPreviousPage: action.hasPreviousPage !== undefined ? action.hasPreviousPage : state.hasPreviousPage,
            };
        case 'FETCH_ERROR':
            return {
                ...state,
                isFetching: false,
                isFetchingNextPage: false,
                isFetchingPreviousPage: false,
                error: action.error,
            };
        case 'SET_PAGINATION':
            return {
                ...state,
                hasNextPage: action.hasNextPage !== undefined ? action.hasNextPage : state.hasNextPage,
                hasPreviousPage: action.hasPreviousPage !== undefined ? action.hasPreviousPage : state.hasPreviousPage,
            };
        default:
            return state;
    }
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

    // --- EXTERNAL STORE SUBSCRIPTION (Concurrency Safe) ---
    const subscribe = useCallback((onStoreChange: () => void) => {
        const signal = client.getSignal<InfiniteData<T>>(infiniteQueryKey);
        return signal.subscribe(() => onStoreChange());
    }, [client, queryKeyHash]);

    const getSnapshot = useCallback(() => {
        const signal = client.getSignal<InfiniteData<T>>(infiniteQueryKey);
        return signal.get();
    }, [client, queryKeyHash]);

    // Read data from external store
    const cacheEntry = useSyncExternalStore(subscribe, getSnapshot);
    const data = cacheEntry?.data;

    // --- LOCAL STATUS STATE ---
    const [statusState, dispatch] = useReducer(statusReducer, {
        isFetching: false,
        isFetchingNextPage: false,
        isFetchingPreviousPage: false,
        error: null,
        hasNextPage: false, // Will be set after first fetch
        hasPreviousPage: false,
    });

    // Stable refs for dependencies
    const queryFnRef = useRef(queryFn);
    const getNextPageParamRef = useRef(getNextPageParam);
    const getPreviousPageParamRef = useRef(getPreviousPageParam);
    const initialFetchDoneRef = useRef(false);
    const clientRef = useRef(client);
    const infiniteQueryKeyRef = useRef(infiniteQueryKey);
    const initialPageParamRef = useRef(initialPageParam);
    const staleTimeRef = useRef(staleTime);
    const cacheTimeRef = useRef(cacheTime);

    useEffect(() => {
        queryFnRef.current = queryFn;
        getNextPageParamRef.current = getNextPageParam;
        getPreviousPageParamRef.current = getPreviousPageParam;
        clientRef.current = client;
        infiniteQueryKeyRef.current = infiniteQueryKey;
        initialPageParamRef.current = initialPageParam;
        staleTimeRef.current = staleTime;
        cacheTimeRef.current = cacheTime;
    });

    // Detect invalidation and reset fetch tracker
    const prevDataRef = useRef(data);
    useEffect(() => {
        // If data goes from defined to undefined, we've been invalidated
        // NOTE: Soft invalidation in QueryCache now calls signal.set(undefined)
        // so data triggers this effect.
        if (prevDataRef.current && !data) {
            initialFetchDoneRef.current = false; // Reset so refetch can run
        }
        prevDataRef.current = data;
    }, [data]);

    // Initial fetch + Refetch on invalidation 
    useEffect(() => {
        if (!enabled) return;
        if (data) return; // Don't run if we have data

        const doFetch = async () => {
            // Respect proper initial page param (including null)
            const initialParam = initialPageParamRef.current;
            const firstParam = (initialParam !== undefined ? initialParam : 0) as TPageParam;

            if (!initialFetchDoneRef.current) {
                initialFetchDoneRef.current = true;
            }

            dispatch({ type: 'FETCH_START', direction: 'initial' });

            // Use deduplication via client.fetch
            // Uniqueness key includes initial param
            const pageKey = [...infiniteQueryKey, 'initial', String(firstParam)];

            let firstPage: T | undefined;
            try {
                firstPage = await clientRef.current.fetch(pageKey, () =>
                    queryFnRef.current({ pageParam: firstParam })
                );
            } catch (error) {
                dispatch({ type: 'FETCH_ERROR', error: error as Error });
                return;
            }

            if (firstPage) {
                const initialData: InfiniteData<T> = {
                    pages: [firstPage],
                    pageParams: [firstParam],
                };

                // Check for next page
                let hasNext = false;
                if (getNextPageParamRef.current) {
                    const nextParam = getNextPageParamRef.current(firstPage, [firstPage]);
                    hasNext = nextParam !== undefined;
                }

                // Update cache
                clientRef.current.set(infiniteQueryKeyRef.current, initialData, {
                    staleTime: staleTimeRef.current,
                    cacheTime: cacheTimeRef.current
                });
                dispatch({ type: 'FETCH_SUCCESS', hasNextPage: hasNext });
            }
        };

        doFetch();
    }, [enabled, data]); // ONLY enabled and data!

    const fetchPageHelper = useCallback(async (pageParam: TPageParam): Promise<T | undefined> => {
        try {
            // Deduplicate requests based on queryKey + pageParam
            const pageKey = [...infiniteQueryKey, String(pageParam)];

            return await clientRef.current.fetch(pageKey, () =>
                queryFnRef.current({ pageParam })
            );
        } catch (error) {
            dispatch({ type: 'FETCH_ERROR', error: error as Error });
            return undefined;
        }
    }, [client, infiniteQueryKey]);

    const fetchNextPage = useCallback(async () => {
        if (!statusState.hasNextPage || statusState.isFetchingNextPage || !data) return;

        const lastPage = data.pages[data.pages.length - 1];
        if (!lastPage || !getNextPageParamRef.current) return;

        const nextPageParam = getNextPageParamRef.current(lastPage, data.pages);
        if (nextPageParam === undefined) return;

        dispatch({ type: 'FETCH_START', direction: 'next' });
        const newPage = await fetchPageHelper(nextPageParam as TPageParam);

        if (newPage) {
            const updatedData: InfiniteData<T> = {
                pages: [...data.pages, newPage],
                pageParams: [...data.pageParams, nextPageParam],
            };

            let hasNext = false;
            if (getNextPageParamRef.current) {
                const nextParam = getNextPageParamRef.current(newPage, updatedData.pages);
                hasNext = nextParam !== undefined;
            }

            clientRef.current.set(infiniteQueryKeyRef.current, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
            dispatch({ type: 'FETCH_SUCCESS', hasNextPage: hasNext });
        }
    }, [statusState.hasNextPage, statusState.isFetchingNextPage, data, fetchPageHelper]);

    const fetchPreviousPage = useCallback(async () => {
        if (!statusState.hasPreviousPage || statusState.isFetchingPreviousPage || !data) return;

        const firstPage = data.pages[0];
        if (!firstPage || !getPreviousPageParamRef.current) return;

        const previousPageParam = getPreviousPageParamRef.current(firstPage, data.pages);
        if (previousPageParam === undefined) return;

        dispatch({ type: 'FETCH_START', direction: 'previous' });
        const newPage = await fetchPageHelper(previousPageParam as TPageParam);

        if (newPage) {
            const updatedData: InfiniteData<T> = {
                pages: [newPage, ...data.pages],
                pageParams: [previousPageParam, ...data.pageParams],
            };

            let hasPrev = false;
            if (getPreviousPageParamRef.current) {
                const prevParam = getPreviousPageParamRef.current(newPage, updatedData.pages);
                hasPrev = prevParam !== undefined;
            }

            clientRef.current.set(infiniteQueryKeyRef.current, updatedData, {
                staleTime: staleTimeRef.current,
                cacheTime: cacheTimeRef.current
            });
            dispatch({ type: 'FETCH_SUCCESS', hasPreviousPage: hasPrev });
        }
    }, [statusState.hasPreviousPage, statusState.isFetchingPreviousPage, data, fetchPageHelper]);

    const refetch = useCallback(async () => {
        initialFetchDoneRef.current = false;
        // Invalidate via QueryCache will set data to undefined, triggering the effect
        clientRef.current.invalidate(infiniteQueryKeyRef.current);
    }, []);

    return {
        data,
        fetchNextPage,
        fetchPreviousPage,
        hasNextPage: statusState.hasNextPage,
        hasPreviousPage: statusState.hasPreviousPage,
        isFetching: statusState.isFetching,
        isFetchingNextPage: statusState.isFetchingNextPage,
        isFetchingPreviousPage: statusState.isFetchingPreviousPage,
        isLoading: data === undefined && statusState.isFetching,
        isError: !!statusState.error,
        error: statusState.error,
        refetch
    };
}
