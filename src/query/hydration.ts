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
    const snapshot = client.getSnapshot();

    snapshot.forEach((signal, hash) => {
        const state = signal.get();
        if (state) {
            queries.push({
                queryKey: state.key as unknown[],
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
        // We restore the state into Key-based storage
        // This implicitly creates the signal if missing
        const key = queryKey as QueryKeyInput;

        // We use client.set to leverage standard flow, 
        // BUT client.set forces status='success' and overwrites everything.
        // We want to restore exact state (including errors etc).
        // So we interpret the signal directly.

        // However, accessing storage directly is private.
        // We should use a dedicated restore method on client or bypass via 'set' with care.
        // Since we are inside the library, we can't access private members of client easily if strictly typed...
        // But here we are in the same package (mostly).

        // Actually best way: add `restore` to QueryCache.
        // For now, let's use `set` and assume we are mostly restoring successful data.
        // If we want perfection, we need `client.restore`.

        // Let's rely on `client.set` for now as MVP, but it sets defaults.
        // To do it 10/10, we should add `restore` to QueryCache.
        client.restore(queryKey, queryState);
    });
}
