import { useEffect, useState, useSyncExternalStore } from 'react';
import { QueryClient, type QueryKeyInput } from './queryClient';
import { QueryObserver, type QueryObserverOptions, type QueryObserverResult } from './queryObserver';
import { type Schema } from './types';

/**
 * Options for a single query in useQueries
 */
export interface UseQueryOptions<T, TData = T> {
    queryKey: QueryKeyInput;
    queryFn: (context?: { signal?: AbortSignal }) => Promise<unknown>;
    schema?: Schema<T>;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    refetchInterval?: number;
    tags?: string[];
    retry?: number | boolean;
    retryDelay?: number | ((attemptIndex: number) => number);
    select?: (data: T) => TData;
}

/**
 * Result type for useQueries
 */
export type UseQueriesResult<T extends readonly unknown[]> = {
    [K in keyof T]: T[K] extends UseQueryOptions<infer TData, infer TSelected>
    ? QueryObserverResult<TSelected>
    : never;
};

/**
 * Execute multiple queries in parallel
 * 
 * @example
 * ```tsx
 * const [user, posts, comments] = useQueries([
 *   { queryKey: ['user', id], queryFn: fetchUser },
 *   { queryKey: ['posts', id], queryFn: fetchPosts },
 *   { queryKey: ['comments', id], queryFn: fetchComments }
 * ]);
 * ```
 */
export function useQueries<T extends readonly UseQueryOptions<any, any>[]>(
    queries: [...T],
    client?: QueryClient
): UseQueriesResult<T> {
    // Get or create client with proper typing
    const queryClient = client || (globalThis as { __QUANTUM_CLIENT__?: QueryClient }).__QUANTUM_CLIENT__;
    if (!queryClient) {
        throw new Error('[Quantum] No QueryClient found. Wrap your app with QueryClientProvider or pass a client.');
    }

    // Create observers for each query
    const [observers] = useState(() =>
        queries.map(options =>
            new QueryObserver(queryClient, options as QueryObserverOptions<any, any>)
        )
    );

    // Subscribe to all observers
    const results = useSyncExternalStore(
        (callback) => {
            const unsubscribes = observers.map(observer => observer.subscribe(callback));
            return () => {
                unsubscribes.forEach(unsub => unsub());
            };
        },
        () => observers.map(observer => observer.getSnapshot()),
        () => observers.map(observer => observer.getSnapshot())
    );

    // Update observers when queries change
    useEffect(() => {
        queries.forEach((options, index) => {
            const observer = observers[index];
            if (observer) {
                observer.setOptions(options as QueryObserverOptions<any, any>);
            }
        });
    }, [queries, observers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            observers.forEach(observer => observer.destroy());
        };
    }, [observers]);

    return results as UseQueriesResult<T>;
}

/**
 * Combine multiple query results with loading/error states
 * 
 * @example
 * ```tsx
 * const combined = useCombinedQueries([
 *   { queryKey: ['user'], queryFn: fetchUser },
 *   { queryKey: ['settings'], queryFn: fetchSettings }
 * ]);
 * 
 * if (combined.isLoading) return <Spinner />;
 * if (combined.isError) return <Error />;
 * 
 * const [user, settings] = combined.data;
 * ```
 */
export function useCombinedQueries<T extends readonly UseQueryOptions<any, any>[]>(
    queries: [...T],
    client?: QueryClient
) {
    const results = useQueries(queries, client);

    const isLoading = results.some(r => r.isLoading);
    const isFetching = results.some(r => r.isFetching);
    const isError = results.some(r => r.isError);
    const isSuccess = results.every(r => r.isSuccess);
    const isPending = results.some(r => r.isPending);

    const errors = results
        .filter(r => r.error)
        .map(r => r.error) as Error[];

    const data = results.map(r => r.data);

    return {
        data,
        results,
        isLoading,
        isFetching,
        isError,
        isSuccess,
        isPending,
        errors,
        refetchAll: () => Promise.all(results.map(r => r.refetch()))
    };
}
