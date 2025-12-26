/**
 * Query Hooks & Cache Exports
 */

export { QueryClient } from './queryClient';
export type { CacheEntry, QueryKey, QueryKeyInput, QueryStatus } from './queryClient';

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
export { useQueryStore } from './useQueryStore';
export { useQuery$ } from './useQuerySignal';

