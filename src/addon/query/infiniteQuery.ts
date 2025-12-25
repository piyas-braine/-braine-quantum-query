/**
 * Infinite Query Hook
 * Provides infinite scroll with cursor/offset pagination
 */

// ... imports
// ... imports
import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useQueryClient } from './context';
import { stableHash } from './utils';

export interface UseInfiniteQueryOptions<T, TPageParam = any> {
    queryKey: string[];
    queryFn: (context: { pageParam: TPageParam }) => Promise<T>;
    getNextPageParam?: (lastPage: T, allPages: T[]) => TPageParam | undefined;
    getPreviousPageParam?: (firstPage: T, allPages: T[]) => TPageParam | undefined;
    initialPageParam?: TPageParam;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
}

export interface InfiniteQueryResult<T> {
    data: { pages: T[]; pageParams: any[] } | undefined;
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
    staleTime,
    cacheTime,
    enabled = true
}: UseInfiniteQueryOptions<T, TPageParam>): InfiniteQueryResult<T> {
    const client = useQueryClient();
    const [state, dispatch] = useReducer(
        reducer as React.Reducer<State<T, TPageParam>, Action<T, TPageParam>>,
        initialState as State<T, TPageParam>,
        (init) => ({
            ...init,
            data: { pages: [], pageParams: [initialPageParam as TPageParam] },
            hasNextPage: true, // Default to true until proven otherwise
        })
    );
    // ...

    // Refs for callbacks to avoid effect re-runs
    const getNextPageParamRef = useRef(getNextPageParam);
    const getPreviousPageParamRef = useRef(getPreviousPageParam);

    useEffect(() => {
        getNextPageParamRef.current = getNextPageParam;
        getPreviousPageParamRef.current = getPreviousPageParam;
    });

    // Stable query key hash
    const queryKeyHash = stableHash(queryKey);

    // Fetch a single page
    const fetchPage = useCallback(async (
        pageParam: TPageParam,
        direction: 'next' | 'previous' | 'initial' = 'initial'
    ) => {
        if (!enabled) return;

        const pageQueryKey = [...queryKey, 'page', pageParam];

        // Check cache first
        const cached = client.get<T>(pageQueryKey);
        if (cached && !client.isStale(pageQueryKey)) {
            return cached;
        }

        try {
            dispatch({ type: 'FETCH_START', direction });
            const result = await queryFn({ pageParam });
            // Cache the result
            client.set(pageQueryKey, result, { staleTime, cacheTime });
            return result;
        } catch (error) {
            dispatch({ type: 'FETCH_ERROR', error: error as Error });
            return undefined;
        } finally {
            // Dispatch handled in specific flows or here if needed, 
            // but specific flows need the result to update pages.
            // We'll let the caller handle success dispatch to keep it atomic with page updates.
        }
    }, [queryKeyHash, queryFn, enabled, staleTime, cacheTime, client]);

    // Initial load
    useEffect(() => {
        if (!enabled) return;

        const loadInitial = async () => {
            dispatch({ type: 'FETCH_START', direction: 'initial' });

            const firstParam = initialPageParam as TPageParam;
            // Check if we already have data (from state hydration or prev render)?
            // For now, simple fetch.

            const firstPage = await fetchPage(firstParam, 'initial');

            if (firstPage) {
                let hasNext = false;
                if (getNextPageParamRef.current) {
                    const nextParam = getNextPageParamRef.current(firstPage, [firstPage]);
                    hasNext = nextParam !== undefined;
                }

                dispatch({
                    type: 'FETCH_SUCCESS_INITIAL',
                    pages: [firstPage],
                    pageParams: [firstParam],
                    hasNextPage: hasNext
                });
            } else {
                // Error handled in fetchPage via dispatch? 
                // Actually fetchPage catches error and returns undefined but dispatches error.
                // So we just stop.
                dispatch({ type: 'FETCH_STOP' });
            }
        };

        loadInitial();
    }, [enabled, fetchPage]); // Stable fetchPage

    const fetchNextPage = useCallback(async () => {
        if (!state.hasNextPage || state.isFetchingNextPage) return;

        const lastPage = state.data?.pages[state.data.pages.length - 1];
        if (!lastPage || !getNextPageParamRef.current) return;

        const nextPageParam = getNextPageParamRef.current(lastPage, state.data.pages);
        if (nextPageParam === undefined) {
            // Should have been caught by hasNextPage, but safe guard
            return;
        }

        const newPage = await fetchPage(nextPageParam, 'next');
        if (newPage) {
            const allPages = [...(state.data?.pages || []), newPage];
            let hasNext = false;
            if (getNextPageParamRef.current) {
                const nextParam = getNextPageParamRef.current(newPage, allPages);
                hasNext = nextParam !== undefined;
            }

            dispatch({
                type: 'FETCH_SUCCESS_NEXT',
                page: newPage,
                param: nextPageParam,
                hasNextPage: hasNext
            });
        } else {
            dispatch({ type: 'FETCH_STOP' });
        }
    }, [state.hasNextPage, state.isFetchingNextPage, state.data?.pages, fetchPage]);

    const fetchPreviousPage = useCallback(async () => {
        if (!state.hasPreviousPage || state.isFetchingPreviousPage || !getPreviousPageParamRef.current) return;

        const firstPage = state.data?.pages[0];
        if (!firstPage) return;

        const previousPageParam = getPreviousPageParamRef.current(firstPage, state.data.pages);
        if (previousPageParam === undefined) return;

        const newPage = await fetchPage(previousPageParam, 'previous');
        if (newPage) {
            const allPages = [newPage, ...(state.data?.pages || [])];
            let hasPrev = false;
            if (getPreviousPageParamRef.current) {
                const prevParam = getPreviousPageParamRef.current(newPage, allPages);
                hasPrev = prevParam !== undefined;
            }

            dispatch({
                type: 'FETCH_SUCCESS_PREVIOUS',
                page: newPage,
                param: previousPageParam,
                hasPreviousPage: hasPrev
            });
        } else {
            dispatch({ type: 'FETCH_STOP' });
        }
    }, [state.hasPreviousPage, state.isFetchingPreviousPage, state.data?.pages, fetchPage]);

    const refetch = useCallback(async () => {
        dispatch({ type: 'RESET' });
        client.invalidate(queryKey);

        // Trigger initial load logic again
        // We can reuse the effect logic or just call it here. 
        // Calling fetchPage(initial) is easiest.

        // NOTE: The effect will run if enabled is toggled or deps change.
        // But refetch is manual.

        dispatch({ type: 'FETCH_START', direction: 'initial' });
        const firstParam = initialPageParam as TPageParam;
        const firstPage = await fetchPage(firstParam, 'initial');

        if (firstPage) {
            let hasNext = false;
            if (getNextPageParamRef.current) {
                const nextParam = getNextPageParamRef.current(firstPage, [firstPage]);
                hasNext = nextParam !== undefined;
            }
            dispatch({
                type: 'FETCH_SUCCESS_INITIAL',
                pages: [firstPage],
                pageParams: [firstParam],
                hasNextPage: hasNext
            });
        } else {
            dispatch({ type: 'FETCH_STOP' });
        }
    }, [queryKeyHash, fetchPage, initialPageParam, client]);

    return {
        data: state.data,
        fetchNextPage,
        fetchPreviousPage,
        hasNextPage: state.hasNextPage,
        hasPreviousPage: state.hasPreviousPage,
        isFetching: state.isFetching,
        isFetchingNextPage: state.isFetchingNextPage,
        isFetchingPreviousPage: state.isFetchingPreviousPage,
        isLoading: state.isLoading,
        isError: state.isError,
        error: state.error,
        refetch
    };
}

// --- Reducer ---

interface State<T, TPageParam> {
    data: { pages: T[]; pageParams: TPageParam[] };
    isLoading: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
    isError: boolean;
    error: Error | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

const initialState: State<any, any> = {
    data: { pages: [], pageParams: [] },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchingPreviousPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    hasPreviousPage: false,
};

type Action<T, TPageParam> =
    | { type: 'FETCH_START'; direction: 'initial' | 'next' | 'previous' }
    | { type: 'FETCH_SUCCESS_INITIAL'; pages: T[]; pageParams: TPageParam[]; hasNextPage: boolean }
    | { type: 'FETCH_SUCCESS_NEXT'; page: T; param: TPageParam; hasNextPage: boolean }
    | { type: 'FETCH_SUCCESS_PREVIOUS'; page: T; param: TPageParam; hasPreviousPage: boolean }
    | { type: 'FETCH_ERROR'; error: Error }
    | { type: 'FETCH_STOP' }
    | { type: 'RESET' };

function reducer<T, TPageParam>(state: State<T, TPageParam>, action: Action<T, TPageParam>): State<T, TPageParam> {
    switch (action.type) {
        case 'FETCH_START':
            return {
                ...state,
                isLoading: action.direction === 'initial',
                isFetching: true,
                isFetchingNextPage: action.direction === 'next',
                isFetchingPreviousPage: action.direction === 'previous',
                isError: false,
                error: null,
            };
        case 'FETCH_SUCCESS_INITIAL':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                data: { pages: action.pages, pageParams: action.pageParams },
                hasNextPage: action.hasNextPage,
                isFetchingNextPage: false,
                isFetchingPreviousPage: false
            };
        case 'FETCH_SUCCESS_NEXT':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isFetchingNextPage: false,
                data: {
                    pages: [...state.data.pages, action.page],
                    pageParams: [...state.data.pageParams, action.param]
                },
                hasNextPage: action.hasNextPage
            };
        case 'FETCH_SUCCESS_PREVIOUS':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isFetchingPreviousPage: false,
                data: {
                    pages: [action.page, ...state.data.pages],
                    pageParams: [action.param, ...state.data.pageParams]
                },
                hasPreviousPage: action.hasPreviousPage
            };
        case 'FETCH_ERROR':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isFetchingNextPage: false,
                isFetchingPreviousPage: false,
                isError: true,
                error: action.error,
            };
        case 'FETCH_STOP':
            return {
                ...state,
                isLoading: false,
                isFetching: false,
                isFetchingNextPage: false,
                isFetchingPreviousPage: false,
            };
        case 'RESET':
            return {
                ...state,
                data: { pages: [], pageParams: [] },
                hasNextPage: false,
                hasPreviousPage: false
            };
        default:
            return state;
    }
}
