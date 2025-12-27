import type { PersistQueryClientOptions, DehydratedState, PersistedClient, DehydratedQuery } from './types';
import type { QueryPlugin } from '../../query/types';

export async function persistQueryClient(options: PersistQueryClientOptions) {
    const { queryClient, persister, maxAge = 1000 * 60 * 60 * 24, buster = '' } = options;

    // 1. Hydrate helper
    const hydrate = (state: DehydratedState) => {
        state.queries.forEach(query => {
            const { queryKey, ...entry } = query;
            // Only restore if valid
            if (Date.now() - entry.timestamp <= maxAge) {
                queryClient.set(queryKey, entry.data, {
                    staleTime: entry.staleTime,
                    cacheTime: entry.cacheTime
                });
            }
        });
    };

    // 2. Attempt restore
    try {
        const persistedClient = await persister.restoreClient();
        if (persistedClient) {
            if (persistedClient.timestamp > Date.now() - maxAge && persistedClient.buster === buster) {
                hydrate(persistedClient.clientState);
            } else {
                await persister.removeClient();
            }
        }
    } catch (err) {
        console.error('Quantum Query: Failed to restore client', err);
    }

    // 3. Subscribe to changes via Plugin
    const save = () => {
        const queries: DehydratedQuery[] = [];
        const cacheMap = queryClient.getAll();

        for (const [keyStr, entry] of cacheMap.entries()) {
            // Type guard: ensure key is array
            const queryKey = Array.isArray(entry.key) ? entry.key : [entry.key];

            queries.push({
                queryKey,
                data: entry.data,
                timestamp: entry.timestamp,
                staleTime: entry.staleTime,
                cacheTime: entry.cacheTime
            });
        }

        const dehydratedState: DehydratedState = { queries };
        const client: PersistedClient = {
            timestamp: Date.now(),
            buster,
            clientState: dehydratedState
        };

        persister.persistClient(client);
    };

    const plugin: QueryPlugin = {
        name: 'persist-plugin',
        onFetchSuccess: () => save(),
        onQueryUpdated: () => save(),
        // onInvalidate: () => save(), // Maybe not needed if invalidate doesn't change data immediately?
    };

    queryClient.use(plugin);
}
