import { useQuery, type UseQueryOptions, type UseQueryResult } from './useQuery';
import { useQueryClient } from './context';
import { stableHash } from './utils';
import { type CacheEntry } from './queryClient';

export interface UseSuspenseQueryOptions<T> extends UseQueryOptions<T> {
}

export type SuspenseQueryResult<T> = Omit<UseQueryResult<T, T>, 'data' | 'isLoading' | 'isError' | 'error'> & {
    data: T; // Data is guaranteed to be present
};

export function useSuspenseQuery<T>(options: UseSuspenseQueryOptions<T>): SuspenseQueryResult<T> {
    const client = useQueryClient();
    // We can reuse useQuery generally, but we need to suspend if data is missing.
    // However, classic useQuery relies on useEffect to fetch, which runs AFTER render.
    // Suspense requires throwing promise DURING render.
    // So we must check if data exists. If not, initiate fetch (deduplicated) and throw promise.

    // We check signal directly first
    const signal = client.getSignal<T>(options.queryKey);
    const entry = signal.get();

    // Check if we need to suspend
    // If no data and not error -> suspend.
    // Wait, if it's already fetching (due to prefetch or another component), we grab that promise.
    // If it's not fetching, we must trigger fetch synchronously (or throw a promise that triggers it).

    // Simplified logic: useQuery handles subscription. We just add the throwing part.
    // But useQuery fetches in useEffect. That's too late for Suspense (waterfall if we don't throw).
    // Actually, if we throw, useEffect never runs.

    // So we must manually ensure fetch is started.

    const shouldSuspend = !entry || (entry.status === 'pending' && entry.data === undefined);

    if (shouldSuspend) {
        // Find existing promise in deduplication cache?
        // QueryClient doesn't expose deduplicationCache publicly.
        // But `fetch` returns a promise.
        // If we call `fetch` without options, it deduplicates.
        // BUT `fetch` is async. We are in render. We can call it but we shouldn't await.
        // We throw the promise returned by `fetch`.

        // We need to construct the fn wrapper as used in useQuery.
        // This duplicates logic from useQuery somewhat.

        // Better approach: Check if entry is loading. If so, we need the promise.
        // But where do we get the promise? The signal doesn't store the promise.
        // TanStack uses a "QueryObserver" class that tracks the promise.
        // We use simple signals.

        // Pragmantic solution:
        // If we need to suspend, call `client.fetch` (which deduplicates) and throw the result.
        // BUT `useQuery` expects `queryFn`. We need the `queryFn` here too.

        // Side effect in render? Generally discouraged but necessary for Suspense-during-render fetch initiation if not preloaded.
        // Or we use `suspend-react` pattern.

        // We need the promise to UPDATE the cache when it resolves, so the next render finds data.
        // client.fetch does NOT update cache on success (useQuery does that).
        const fetchPromise = client.fetch(options.queryKey,
            (ctx) => options.queryFn({ ...ctx, signal: undefined }),
            { signal: undefined }
        ).then(data => {
            // Update Cache on success
            client.set(options.queryKey, data);
            return data;
        });

        // Throw the promise to Suspend
        throw fetchPromise;
    }

    if (entry?.status === 'error') {
        throw entry.error;
    }

    // If we are here, we have data.
    // We still call useQuery to setup subscriptions and background updates.
    // But we override options to avoid double-fetching if we just suspended?
    // No, useQuery handles freshness checks.

    const query = useQuery(options);

    return {
        ...query,
        data: query.data as T
    };
}
