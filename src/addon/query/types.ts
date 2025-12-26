/**
 * Generic Schema Interface
 * Compatible with Zod, Valibot, ArkType, etc.
 */
export interface Schema<T> {
    parse: (data: unknown) => T;
}

export interface QueryClientConfig {
    defaultStaleTime?: number;
    defaultCacheTime?: number;
}

/**
 * Middleware Plugin Interface
 */
export interface QueryPlugin {
    name: string;
    onFetchStart?: (queryKey: unknown[]) => void;
    onFetchSuccess?: (queryKey: unknown[], data: unknown) => void;
    onFetchError?: (queryKey: unknown[], error: Error) => void;
    onInvalidate?: (queryKey: unknown[]) => void;
    onQueryUpdated?: (queryKey: unknown[], data: unknown) => void;
}

export interface InfiniteData<T> {
    pages: T[];
    pageParams: unknown[];
}
