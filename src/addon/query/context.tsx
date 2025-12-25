import React, { createContext, useContext, ReactNode } from 'react';
import { QueryCache, queryCache as defaultCache } from './queryCache';

// Re-export QueryCache as QueryClient for conceptual clarity if needed, 
// or just use QueryCache instance as the client.
export type QueryClient = QueryCache;

const QueryClientContext = createContext<QueryClient | undefined>(undefined);

export const QueryClientProvider = ({
    client,
    children
}: {
    client: QueryClient;
    children: ReactNode
}) => {
    return (
        <QueryClientContext.Provider value={client}>
            {children}
        </QueryClientContext.Provider>
    );
};

export const useQueryClient = (): QueryClient => {
    const client = useContext(QueryClientContext);
    // Fallback to global singleton for Zero-Config usage
    return client || defaultCache;
};
