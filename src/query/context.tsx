import React, { createContext, useContext, type ReactNode } from 'react';
import { QueryCache } from './queryCache';

// Re-export QueryCache as QueryClient for conceptual clarity if needed, 
// or just use QueryCache instance as the client.
export type QueryClient = QueryCache;

const QueryClientContext = createContext<QueryClient | undefined>(undefined);

export const createQueryClient = (config?: { defaultStaleTime?: number; defaultCacheTime?: number }) => new QueryCache(config);

export const QueryClientProvider = ({
    client,
    children
}: {
    client: QueryClient;
    children: ReactNode | undefined;
}) => {
    return (
        <QueryClientContext.Provider value={client}>
            {children || null}
        </QueryClientContext.Provider>
    );
};

export const useQueryClient = (): QueryClient => {
    const client = useContext(QueryClientContext);
    if (!client) {
        throw new Error('No QueryClient set, use QueryClientProvider to set one');
    }
    return client;
};
