import { QueryCache, type CacheEntry, type QueryKeyInput } from './queryCache';
import { stableHash } from './utils';

export interface DehydratedState {
    queries: Array<{
        queryKey: unknown[];
        queryHash: string;
        state: CacheEntry<unknown>;
    }>;
}

/**
 * Serialize the query cache for transport.
 */
export function dehydrate(client: QueryCache): DehydratedState {
    const queries: DehydratedState['queries'] = [];

    // Access private signals? 
    // We need a way to iterate queries. 
    // QueryCache doesn't expose iteration publicly?
    // We might need to add `getAll()` to QueryCache or access internal map if allowed.
    // For now, let's assume we can add `getAll()` to QueryCache or use existing method.
    // QueryCache has `signals` map private.
    // We should add `snapshot()` method to QueryCache.

    // Assuming client.snapshot() exists (we will add it).
    const snapshot = client.snapshot();

    snapshot.forEach((signal, hash) => {
        const state = signal.get();
        if (state) {
            queries.push({
                queryKey: state.key as unknown[], // Cast to mutable array for serialization
                queryHash: hash,
                state: state
            });
        }
    });

    return { queries };
}

/**
 * Hydrate the query cache from serialized state.
 */
export function hydrate(client: QueryCache, state: DehydratedState) {
    if (!state || !state.queries) return;

    state.queries.forEach(({ queryKey, state: queryState }) => {
        // We set the state directly
        // We might want to mark it as 'fresh' regarding hydration time?
        // TanStack Query has options for overrides.
        // Simple implementation:
        client.set(queryKey, queryState.data, {
            // We restore metadata
            staleTime: queryState.staleTime,
            cacheTime: queryState.cacheTime,
            tags: queryState.tags
        });

        // We unfortunately lost 'error' and 'status' in client.set signature if we only pass data?
        // client.set signature: (key, data, options)
        // options only allow staleTime/cacheTime.
        // It updates status to 'success'.
        // If we want to hydrate ERROR state or LOADING state?
        // We need `client.restore(key, state)`.

        // Let's assume we implement `client.restore` or access signal directly.
        const signal = client.getSignal(queryKey);
        signal.set({
            ...queryState,
            // Ensure methods/prototypes are not expected on state (it's JSON)
        });
    });
}
