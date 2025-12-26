# useQuery

Subscribes to a query and returns the current state.

```tsx
const { data, isLoading, error } = useQuery(options)
```

## Options

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`queryKey`** | \`readonly unknown[]\` | **Required** | Unique key for the query. |
| **`queryFn`** | \`() => Promise&lt;T&gt;\` | **Required** | The function that fetches data. |
| **`enabled`** | \`boolean\` | \`true\` | Set to \`false\` to disable automatic triggering. |
| **`staleTime`** | \`number\` | \`0\` | Time in ms before data is considered stale. |
| **`cacheTime`** | \`number\` | \`300,000\` | Time in ms unused data remains in memory (5 mins). |
| **`refetchInterval`** | \`number\` | \`false\` | If set, refetches every N milliseconds. |
| **`refetchOnWindowFocus`** | \`boolean\` | \`true\` | Refetch when window gains focus. |
| **`refetchOnReconnect`** | \`boolean\` | \`true\` | Refetch when network reconnects. |
| **`select`** | \`(data: T) => R\` | - | Transform/Select data. **Optimizes renders.** |
| **`initialData`** | \`T\` | - | Initial data to populate the cache. |
| **`placeholderData`** | \`T\` | - | Data to show while loading (not cached). |
| **`retry`** | \`boolean | number\` | \`3\` | Number of retries on failure. |

## Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| **`data`** | \`T\` | The resolved data. |
| **`error`** | \`Error\` | The error object if state is 'error'. |
| **`status`** | \`'pending' \| 'success' \| 'error'\` | High-level status. |
| **`isLoading`** | \`boolean\` | True if finding data for the first time. |
| **`isFetching`** | \`boolean\` | True if any request is in flight. |
| **`isStale`** | \`boolean\` | True if data is older than \`staleTime\`. |
| **`refetch`** | \`() => Promise\` | Function to manually trigger a refetch. |
