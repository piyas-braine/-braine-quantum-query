import { QueryCache } from '../query/queryCache';

export interface DehydratedQuery {
    queryKey: unknown[];
    data: unknown;
    timestamp: number;
    staleTime: number;
    cacheTime: number;
}

export interface DehydratedState {
    queries: DehydratedQuery[];
}

export interface PersistedClient {
    timestamp: number;
    buster: string;
    clientState: DehydratedState;
}

export interface Persister {
    persistClient(persistClient: PersistedClient): void | Promise<void>;
    restoreClient(): PersistedClient | undefined | Promise<PersistedClient | undefined>;
    removeClient(): void | Promise<void>;
}

export interface PersistQueryClientOptions {
    queryClient: QueryCache;
    persister: Persister;
    maxAge?: number; // 24 hours default
    buster?: string;
}
