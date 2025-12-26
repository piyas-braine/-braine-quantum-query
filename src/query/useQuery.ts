/**
 * useQuery Hook
 * Base query hook with stale-while-revalidate and background refetching
 * 
 * Refactored to use QueryObserver (Clean Architecture)
 */

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { useQueryClient } from './context';
import { type Schema } from './types';
import { type QueryKeyInput, type CacheEntry } from './queryClient';
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
    schema?: Schema<T>;
    tags?: string[];
}

// Assuming QueryStatus and FetchDirection are defined elsewhere or will be added.
// For now, using placeholder types if not explicitly defined in the provided context.
type QueryStatus = 'pending' | 'error' | 'success';
type FetchDirection = 'idle' | 'fetching';

export interface UseQueryResult<TData, T, TError = Error> {
    data: TData | undefined;
    status: QueryStatus;
    fetchStatus: FetchDirection;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    isLoading: boolean;
    isFetching: boolean;
    isStale: boolean;
    error: TError | null;
    refetch: () => void;
    signal: Signal<CacheEntry<T> | undefined>;
}

export function useQuery<T, TData = T, TError = Error>(
    options: UseQueryOptions<T, TData>
): UseQueryResult<TData, T, TError> {
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
    const memoRef = useRef<{ entry: QueryObserverResult<T> | undefined; selected: unknown }>({ entry: undefined, selected: undefined });

    const getSnapshotWithSelector = useCallback(() => {
        // The observer's getSnapshot returns the QueryObserverResult
        const entry = observer.getSnapshot();

        // If the entry reference hasn't changed, return the previously selected/processed value
        if (entry === memoRef.current.entry) {
            return memoRef.current.selected;
        }

        // Entry has changed. Process it.
        let processedResult: unknown;

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
        // Type safe return
        return processedResult as QueryObserverResult<TData>;
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

    const res = result as Record<string, unknown> | undefined;
    const status = (res?.status as string) || 'pending';
    const computedResult = {
        ...(res || {}),
        isPending: status === 'pending',
        isSuccess: status === 'success',
        isError: status === 'error',
        isLoading: (res?.isLoading as boolean) ?? (status === 'pending' && res?.data === undefined),
        isStale: (res?.isStale as boolean) ?? true,
    } as UseQueryResult<TData, T, TError>;

    const typedResult = computedResult;

    // Expose raw signal just in case (as per previous feature request)
    // QueryObserver has a private signal. We might need to expose it publicly on Observer? 
    // Or just fetch it from client here? 
    const signal = client.getSignal<T>(options.queryKey);

    return {
        ...typedResult,
        signal: signal as Signal<CacheEntry<T> | undefined> // Keep signal as T (source)
    };
}

/**
 * Advanced: Access the raw signal for fine-grained reactivity (Bypasses React Render Loop)
 * Use this with <SignalValue /> or similar helpers to update DOM without re-rendering components.
 */
export function useQuerySignal<T>(options: UseQueryOptions<T>): Signal<CacheEntry<T> | undefined> {
    const client = useQueryClient();
    // We can rely on the cache to hold the signal. 
    // However, to ensure fetch triggers, we might need an observer side-effect?
    // For pure signal access, we assume 'useQuery' or 'prefetch' has been called, 
    // OR we can mount a "headless" observer.

    // For now, simple access:
    const signal = client.getSignal<T>(options.queryKey);

    // Auto-fetch if stale? 
    // Signals represent *state*, not *effects*. 
    // If you want auto-fetch, you need an Observer. 
    // Let's create a lightweight observer that stays alive? 
    // Or just return the signal and let the user handle fetching?
    // The "Better" way is to attach a headless observer.

    useEffect(() => {
        const observer = new QueryObserver<T>(client, options);
        const unsubscribe = observer.subscribe(() => { }); // Keep alive
        return () => unsubscribe();
    }, [client, stableHash(options.queryKey)]);

    return signal;
}
