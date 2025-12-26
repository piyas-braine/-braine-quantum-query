import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useQueryClient } from './context';
import { type Schema } from './types';
import { type CacheEntry } from './queryClient';
import { type Signal } from '../signals';
import { QueryObserver, type QueryObserverResult, type QueryObserverOptions } from './queryObserver';

export interface UseQueryOptions<T, TData = T> extends QueryObserverOptions<T, TData> {
    // Re-export options from observer
}

export interface UseQueryResult<TData, T> extends QueryObserverResult<TData> {
    signal: Signal<QueryObserverResult<TData>>;
}

export function useQuery<T, TData = T>(
    options: UseQueryOptions<T, TData>
): UseQueryResult<TData, T> {
    const client = useQueryClient();

    const [observer] = useState(() => new QueryObserver<T, TData>(client, options));

    useEffect(() => {
        observer.setOptions(options);
    }, [observer, options]);

    useEffect(() => {
        return () => {
            observer.destroy();
        };
    }, [observer]);

    const subscribe = useCallback((onStoreChange: () => void) => {
        return observer.subscribe(onStoreChange);
    }, [observer]);

    const getSnapshot = useCallback(() => {
        return observer.getSnapshot();
    }, [observer]);

    const result = useSyncExternalStore(subscribe, getSnapshot);

    return {
        ...result,
        signal: observer.result$
    } as UseQueryResult<TData, T>;
}

