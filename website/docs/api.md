# API Reference

## Hooks

### `useQuery<T>(options)`

Subscribes to a query and returns the current state.

**Options**:
- `queryKey: any[]`: Unique identifier for the query.
- `queryFn: () => Promise<T>`: Async function to fetch data.
- `staleTime?: number`: Time in ms before data is considered stale (default: 0).
- `cacheTime?: number`: Time in ms unused data remains in cache (default: 5 mins).
- `enabled?: boolean`: Set to `false` to disable automatic fetching.
- `refetchOnWindowFocus?: boolean`: Refetch when window gains focus.
- `schema?: Schema<T>`: Zod/Valibot schema for validation.
- `select?: (data: T) => unknown`: Transform data. **Memoized** to prevent re-renders.
- `tags?: string[]`: Array of tags for invalidation key grouping.

**Returns**:
- `data: T | undefined`: The resolved data (or the result of `select`).
- `isLoading: boolean`: True if no data exists.
- `isFetching: boolean`: True if a network request is in flight.
- `error: Error | null`: Error object if the last fetch failed.
- `refetch: () => Promise<void>`: Manually trigger a fetch.

### `useInfiniteQuery<T>(options)`

**Options**:
- `queryKey`, `queryFn`: Same as useQuery.
- `getNextPageParam: (lastPage, allPages) => param`: Function to determine next page param.
- `initialPageParam`: Initial parameter for the first page.

**Returns**:
- `data: InfiniteData<T>`: Object containing `{ pages: T[], pageParams: any[] }`.
- `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`.

## Server-Side Rendering (SSR)

### `dehydrate(client: QueryCache)`
Serializes the current cache state into a JSON-serializable object.

### `hydrate(client: QueryCache, state: DehydratedState)`
Restores a serialized state into the cache.

### `<HydrationBoundary state={state}>`
React component to hydrate the cache from server state for its children.

## Core Classes

### `QueryCache` (exported as `queryCache`)
The brain of the library. Can be used directly for prefetching or imperative updates.

- `.fetch<T>(key, fn)`: Fetches data with **Request Deduplication**.
- `.set<T>(key, data)`: Manually set cache data (Optimistic Updates).
- `.invalidate(key)`: Soft invalidate queries matching the key/prefix.
- `.use(plugin)`: Register middleware.

## Persistence

### `persistQueryClient(options)`
Persists cache to storage.

**Options**:
- `queryClient`: The cache instance.
- `persister`: Storage adapter (e.g., `createLocalStoragePersister`).
- `maxAge`: Max age of persisted data in ms.
