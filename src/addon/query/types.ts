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
    onFetchStart?: (queryKey: any[]) => void;
    onFetchSuccess?: (queryKey: any[], data: any) => void;
    onFetchError?: (queryKey: any[], error: Error) => void;
    onInvalidate?: (queryKey: any[]) => void;
    onQueryUpdated?: (queryKey: any[], data: any) => void;
}

export interface InfiniteData<T> {
    pages: T[];
    pageParams: unknown[];
}
