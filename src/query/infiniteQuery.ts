import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useQueryClient } from './context';
import { InfiniteQueryObserver, type InfiniteQueryObserverOptions, type InfiniteQueryObserverResult } from './infiniteQueryObserver';

export type { InfiniteQueryObserverOptions as UseInfiniteQueryOptions, InfiniteQueryObserverResult as InfiniteQueryResult } from './infiniteQueryObserver';

export function useInfiniteQuery<T, TPageParam = unknown>(
    options: InfiniteQueryObserverOptions<T, TPageParam>
): InfiniteQueryObserverResult<T> {
    const client = useQueryClient();

    // 1. Initialize Observer (Stored in state to persist across renders)
    const [observer] = useState(() => new InfiniteQueryObserver<T, TPageParam>(client, options));

    // 2. Sync options with observer
    useEffect(() => {
        observer.setOptions(options);
    }, [observer, options]);

    // 3. Cleanup on unmount
    useEffect(() => {
        return () => {
            observer.destroy();
        };
    }, [observer]);

    // 4. React to store changes (Re-render when observer state changes)
    const subscribe = useCallback((onStoreChange: () => void) => {
        return observer.result$.subscribe(() => onStoreChange());
    }, [observer]);

    const getSnapshot = useCallback(() => {
        return observer.result$.get();
    }, [observer]);

    // We use useSyncExternalStore for React 18 concurrency safety
    return useSyncExternalStore(subscribe, getSnapshot);
}
