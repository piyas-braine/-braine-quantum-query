/**
 * Query Hooks & Cache Exports
 */

export { QueryCache } from './queryCache';
export type { CacheEntry, QueryKey, QueryKeyInput, QueryStatus } from './queryCache';

export { usePaginatedQuery } from './pagination';
export type { UsePaginatedQueryOptions, PaginatedQueryResult } from './pagination';

export * from './useQuery';
export * from './useMutation';
export { useQueryClient, QueryClientProvider } from './context';
export { useInfiniteQuery } from './infiniteQuery';
export { HydrationBoundary } from './HydrationBoundary';
export { dehydrate, hydrate } from './hydration';
export type { QueryPlugin } from './types';
export type { Signal } from '../signals';
export * from './useSuspenseQuery';
