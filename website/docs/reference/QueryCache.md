# QueryCache

The core class that manages all queries. You generally don't instantiate this yourself, but access the singleton via `useQueryClient` or `new QueryCache()` for SSR.

```tsx
import { QueryCache } from '@braine/quantum-query';
const client = new QueryCache();
```

## Methods

### `fetch<T>(key, fn, options)`
Fetches data. Handles deduplication.

```tsx
const data = await client.fetch(['user', 1], fetchUser);
```

### `set<T>(key, data, options)`
Manually sets data in the cache. Useful for optimistic updates.

```tsx
client.set(['user', 1], { name: 'New Name' });
```

### `invalidate(key)`
Marks queries matching the key as stale. They will refetch on next read.

```tsx
client.invalidate(['user']);
```

### `getSignal<T>(key)`
Returns the raw signal for a query key. Useful for reactive bridges.

```tsx
const signal = client.getSignal(['user', 1]);
```

### `use(plugin)`
Registers a middleware/plugin.

```tsx
client.use(myPlugin);
```
