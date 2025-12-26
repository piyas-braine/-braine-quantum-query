# Queries

In Quantum Query, a "Query" is a declarative dependency on an asynchronous source of truth.

## Basic Usage

The simplest form requires a \`queryKey\` (unique identifier) and a \`queryFn\` (promise-returning function).

```tsx
import { useQuery } from '@braine/quantum-query';

function UserProfile({ userId }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetch(\`/api/users/\${userId}\`).then(res => res.json()),
  });

  if (isLoading) return <span>Loading...</span>;
  if (error) return <span>Error: {error.message}</span>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}
```

## Dependent Queries

Queries can depend on other data. Use the \`enabled\` option to delay fetching until dependencies are ready.

```tsx
function UserPosts({ userId }) {
  // 1. Fetch User
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: fetchUser,
  });

  // 2. Fetch Posts (Only when user.id is available)
  const { data: posts } = useQuery({
    queryKey: ['posts', user?.id],
    queryFn: () => fetchPosts(user.id),
    // The query will not run until this is true
    enabled: !!user?.id, 
  });

  if (!posts) return null;
  return <div>{posts.length} posts found.</div>;
}
```

## Selective Subscriptions (The "Moat") ⚡️

This is where Quantum Query outperforms everyone else. You can subscribe to a *slice* of the data. 

In other libraries, if you select data, the component still re-renders when the *root* data changes, then checks the selector.
In Quantum Query, the component **only** re-renders if the *selected* data changes.

```tsx
function UserStatus({ userId }) {
  const { data: status } = useQuery({
    queryKey: ['user', userId],
    queryFn: fetchUser,
    // Component ONLY re-renders if 'status' string changes.
    // Changing 'name' or 'bio' will have ZERO effect.
    select: (user) => user.status, 
  });

  return <Badge status={status} />;
}
```

## Background Refetching

Keep data fresh automatically.

```tsx
useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  // Refetch every 5 seconds
  refetchInterval: 5000, 
  // Refetch when window regains focus
  refetchOnWindowFocus: true,
});
```
