/**
 * useQuery Hook
 * Base query hook with stale-while-revalidate and background refetching
 * 
 * Refactored to use QueryObserver (Clean Architecture)
 */

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { useQueryClient } from './context';
import { type Schema } from './types';
import { type QueryKeyInput, type CacheEntry } from './queryCache';
import { type Signal } from '../signals';
import { QueryObserver, type QueryObserverResult, type QueryObserverOptions } from './queryObserver';
import { stableHash } from './utils';

// Re-export options for compatibility
export interface UseQueryOptions<T> extends Omit<QueryObserverOptions<T>, 'queryFn'> {
    queryFn: (context?: { signal?: AbortSignal }) => Promise<unknown>;
}

export interface QueryResult<T> extends QueryObserverResult<T> {
    signal: Signal<CacheEntry<T> | undefined>;
}

export function useQuery<T>(options: UseQueryOptions<T>): QueryResult<T> {
    const client = useQueryClient();

    // Stable observer instance
    // We use useState instead of useRef to ensure lazy initialization happens only once safely
    // But typically refs are fine for instances.
    const [observer] = useState(() => new QueryObserver<T>(client, options));

    // Sync properties
    useEffect(() => {
        observer.setOptions(options);
    }, [observer, options]); // Deep compare or individual props? setOptions handles logic.
    // React strict mode might double invoke, but observer handles idempotency.
    // Actually, options object identity changes on every render.
    // QueryObserver.setOptions should handle diffing.
    // But best practice is to spread options or use stableHash in dependency array?
    // Let's pass 'options' but rely on observer to be smart.
    // The previous implementation used stableHash(queryKey) etc.

    // Subscription
    const subscribe = useCallback((onStoreChange: () => void) => {
        return observer.subscribe(onStoreChange);
    }, [observer]);

    const getSnapshot = useCallback(() => {
        return observer.getSnapshot();
    }, [observer]);

    const result = useSyncExternalStore(subscribe, getSnapshot);

    // Expose raw signal just in case (as per previous feature request)
    // QueryObserver has a private signal. We might need to expose it publicly on Observer? 
    // Or just fetch it from client here? 
    const signal = client.getSignal<T>(options.queryKey);

    return {
        ...result,
        signal
    };
}
