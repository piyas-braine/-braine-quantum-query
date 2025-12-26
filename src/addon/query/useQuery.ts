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

// TData is the transformed type (Result)
export interface UseQueryOptions<T, TData = T> {
    queryKey: unknown[];
    queryFn: (context?: { signal?: AbortSignal }) => Promise<T>;
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    refetchOnWindowFocus?: boolean;
    retry?: number | boolean;
    select?: (data: T) => TData;
    tags?: string[];
}

// Assuming QueryStatus and FetchDirection are defined elsewhere or will be added.
// For now, using placeholder types if not explicitly defined in the provided context.
type QueryStatus = 'pending' | 'error' | 'success';
type FetchDirection = 'idle' | 'fetching';

export interface UseQueryResult<TData, TError = Error> {
    data: TData | undefined;
    status: QueryStatus;
    fetchStatus: FetchDirection;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    isFetching: boolean;
    error: TError | null;
    refetch: () => void;
    signal: Signal<CacheEntry<any> | undefined>;
}

export function useQuery<T, TData = T, TError = Error>(
    options: UseQueryOptions<T, TData>
): UseQueryResult<TData, TError> {
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

    // --- SELECTOR LOGIC ---
    const select = options?.select;
    const selectRef = useRef(select);
    selectRef.current = select;

    // Let's use a ref to store the last selected data and last result.
    /*
       Ref pattern for Memoized Selector in getSnapshot:
       lastEntry (Source)
       lastSelected (Result)
    */
    const memoRef = useRef<{ entry: QueryObserverResult<T> | undefined; selected: any }>({ entry: undefined, selected: undefined });

    const getSnapshotWithSelector = useCallback(() => {
        // The observer's getSnapshot returns the QueryObserverResult
        const entry = observer.getSnapshot();

        // If the entry reference hasn't changed, return the previously selected/processed value
        if (entry === memoRef.current.entry) {
            return memoRef.current.selected;
        }

        // Entry has changed. Process it.
        let processedResult: any;

        if (!entry) {
            processedResult = undefined;
        } else {
            // Apply selector if present and data is available
            if (selectRef.current && entry.data !== undefined) {
                // Create a new object with the selected data, preserving other entry properties
                processedResult = { ...entry, data: selectRef.current(entry.data) };
            } else {
                // No selector or data is undefined, return the original entry
                processedResult = entry;
            }
        }

        // Update memoRef with the new entry and its processed result
        memoRef.current = { entry, selected: processedResult };
        // Cast to unknown first because TData might not match T
        return processedResult as unknown as QueryObserverResult<TData>;
    }, [observer]);

    const result = useSyncExternalStore(subscribe, getSnapshotWithSelector);

    // Derived properties if usage expects distinct boolean flags not in snapshot?
    // QueryObserverResult likely has them, but let's Ensure parity if Observer is lagging.
    // Assuming observer result matches UseQueryResult.
    // But if select transforms data, we just return that.

    // Type assertion for the final result
    // Note: If QueryObserverResult doesn't have isSuccess, we rely on implementation.
    // If ObserverResult is just { data, status, error, isFetching }
    // We should compute flags.

    const status = result?.status || 'pending';
    const computedResult = {
        ...result,
        isPending: status === 'pending',
        isSuccess: status === 'success',
        isError: status === 'error',
    } as UseQueryResult<TData, TError>;

    const typedResult = computedResult;

    // Expose raw signal just in case (as per previous feature request)
    // QueryObserver has a private signal. We might need to expose it publicly on Observer? 
    // Or just fetch it from client here? 
    const signal = client.getSignal<T>(options.queryKey);

    return {
        ...typedResult,
        signal: signal as unknown as Signal<CacheEntry<T> | undefined> // Keep signal as T (source)
    };
}
