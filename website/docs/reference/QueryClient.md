# QueryClient

The `QueryClient` is the central facade for the library. It orchestrates storage, remotes, and plugins.

```tsx
import { QueryClient } from '@braine/quantum-query';

const queryClient = new QueryClient({
  defaultStaleTime: 1000 * 60, // 1 minute
  maxCacheSize: 500,
});
```

## Methods

### `fetch&lt;T&gt;(queryKey, queryFn, options)`
The primary method for triggering a network request. It handles deduplication and persistence automatically.

### `set&lt;T&gt;(queryKey, data, options)`
Manually update the cache with new data.
- **Options**: `staleTime`, `cacheTime`, `tags`.

### `invalidate(queryKey)`
Marks all queries matching the key as stale and triggers refetching for active observers.

### `invalidateTags(tags: string[])`
**O(1) Operation.** Instantly invalidates all queries associated with the provided tags.

### `get&lt;T&gt;(queryKey)`
Synchronously get the current data from the cache (if it exists and is not expired).

### `getSignal&lt;T&gt;(queryKey)`
Returns the raw `Signal` for the given key.

### `prefetch(queryKey, data, options)`
Seed the cache with data before it is needed.

### `getStats()`
Returns an object containing cache metrics (`size`, `keys`, `tags`).

---

## Clean Architecture
Internally, the `QueryClient` follows a decoupled architecture. 
- **Storage**: Handles memory, LRU, and expiration.
- **Remotes**: Handles network deduplication and retry logic.
- **PluginManager**: Handles side effects and extensions.
