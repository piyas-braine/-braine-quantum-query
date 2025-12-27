import { useQuery, type UseQueryOptions, type UseQueryResult } from './useQuery';
import { useQueryClient } from './context';
import { type CacheEntry } from './queryClient';

export interface UseSuspenseQueryOptions<T> extends UseQueryOptions<T> {
}

export type SuspenseQueryResult<T> = Omit<UseQueryResult<T, T>, 'data' | 'isLoading' | 'isError' | 'error'> & {
    data: T; // Data is guaranteed to be present
};

export function useSuspenseQuery<T>(options: UseSuspenseQueryOptions<T>): SuspenseQueryResult<T> {
    const client = useQueryClient();
    const signal = client.getSignal<T>(options.queryKey);
    const entry = signal.get();

    // 1. Error Boundary
    if (entry?.status === 'error') {
        throw entry.error;
    }

    // 2. Suspense (Pending or Empty)
    // 2. Suspense (Pending or Empty)
    if (!entry || (entry.status === 'pending' && entry.data === undefined)) {
        // If we have an existing promise (deduplicated), throw it
        if (entry?.promise) {
            throw entry.promise;
        }

        // Otherwise, initiate fetch synchronously and throw the result
        const fetchPromise = client.fetch(options.queryKey, options.queryFn, {
            retry: options.retry,
            retryDelay: options.retryDelay,
            tags: options.tags,
            schema: options.schema
        });

        throw fetchPromise;
    }

    // 3. Subscription (Background Updates)
    // We utilize the standard useQuery hook to handle subscriptions, intervals, etc.
    const query = useQuery(options);

    // 4. Return Data (Guaranteed)
    return {
        ...query,
        data: query.data as T
    };
}
