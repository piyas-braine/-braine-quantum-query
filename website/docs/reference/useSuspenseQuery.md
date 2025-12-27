# useSuspenseQuery

The `useSuspenseQuery` hook is a Suspense-integrated version of `useQuery`. It leverages React Suspense to handle loading states declaratively and Error Boundaries to handle errors.

## Usage

```tsx
import { useSuspenseQuery } from '@braine/quantum-query';

function UserProfile({ userId }) {
  const { data } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId)
  });

  // Data is guaranteed to be defined here
  return <div>{data.name}</div>;
}

function App() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Suspense fallback={<div>Loading user...</div>}>
        <UserProfile userId="123" />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Differences from `useQuery`

| Feature | useQuery | useSuspenseQuery |
| :--- | :--- | :--- |
| **Loading State** | Returns `isLoading: true` | Suspends (throws Promise) |
| **Error State** | Returns `isError: true`, `error: Error` | Throws Error to Boundary |
| **Data Type** | `T \| undefined` | `T` (Always defined) |
| **Status** | `'pending' \| 'success' \| 'error'` | `'success'` (Component only renders on success) |

## Options

Accepts all options from `useQuery`, including:

- `staleTime`
- `cacheTime`
- `retry`
- `refetchInterval`

## Prefetching

To avoid waterfalls, you can prefetch data before rendering the suspense component:

```tsx
const client = useQueryClient();

function onHover() {
  client.prefetchQuery(['user', 123], fetchUser);
}
```
