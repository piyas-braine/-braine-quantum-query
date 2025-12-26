import React, { createContext, useContext, type ReactNode } from 'react';
import { QueryClient } from './queryClient';

const QueryClientContext = createContext<QueryClient | undefined>(undefined);

export const createQueryClient = (config?: { defaultStaleTime?: number; defaultCacheTime?: number }) => new QueryClient(config);

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
