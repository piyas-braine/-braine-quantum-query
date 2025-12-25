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
