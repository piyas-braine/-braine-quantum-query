# Suspense

React Suspense allows you to declaratively handle loading states using boundaries. Quantum Query has first-class support for this pattern.

## useSuspenseQuery

This hook **always** returns data. It never returns \`undefined\`.
- If data is missing -> It **suspends** (throws a promise).
- If fetch fails -> It **throws** an error (caught by ErrorBoundary).

```tsx
import { Suspense } from 'react';
import { useSuspenseQuery } from '@braine/quantum-query';
import { ErrorBoundary } from 'react-error-boundary';

function Post({ id }) {
  // 1. No loading state needed here! Data is guaranteed.
  const { data } = useSuspenseQuery({
    queryKey: ['post', id],
    queryFn: fetchPost,
  });

  return <h1>{data.title}</h1>;
}

function App() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong!</div>}>
      <Suspense fallback={<SkeletonLoader />}>
        <Post id="1" />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Comparisons

| Feature | `useQuery` | `useSuspenseQuery` |
| :--- | :--- | :--- |
| **Response** | `data | undefined`, `isLoading` boolean | `data` (Guaranteed) |
| **Loading UI** | Handled inside component (`if (isLoading)...`) | Handled by parent `<Suspense>` |
| **Error UI** | Handled inside component (`if (error)...`) | Handled by parent `<ErrorBoundary>` |
| **Fetch-on-render** | Yes (might show spinner) | **Render-as-you-fetch** capable |

## Prefetching for Suspense

To avoid "Waterfalls" (where components suspend one by one), prefetch data early.

```tsx
// In a parent component or router loader
client.prefetch(['post', 1], fetchPost);

// In the child
useSuspenseQuery(...) // Data likely already there!
```
