# Recipes

## Authentication & Refresh Tokens
Configure global authentication handling, including automatic token injection and seamless refresh flows on 401 errors.

```typescript
import { createClient } from '@braine/quantum-query';

const client = createClient({
  baseURL: 'https://api.example.com',
  auth: {
    // 1. Inject Token: Called before every request
    getToken: async () => {
      const token = localStorage.getItem('access_token');
      return token; // Returns string or null
    },

    // 2. Refresh Logic: Called automatically on 401 response
    onTokenExpired: async (client) => {
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return null;

        // Perform refresh using a separate fetch or client instance
        // to avoid infinite loops if the refresh endpoint also returns 401
        const response = await fetch('https://api.example.com/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) throw new Error('Refresh failed');

        const data = await response.json();
        
        // Save new tokens
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);

        return data.accessToken; // Return new token to retry original request
      } catch (err) {
        // Refresh failed - clean up and redirect
        localStorage.clear();
        window.location.href = '/login';
        return null;
      }
    },

    // 3. Auth Failed: Called if onTokenExpired returns null or fails
    onAuthFailed: () => {
      window.location.href = '/login';
    }
  }
});
```

## Optimistic Updates
Update the UI immediately before the network request finishes.

```typescript
const { refetch } = useQuery({ queryKey: ['todos'], ... });

const handleAddTodo = async (newTodo) => {
    // 1. Snapshot previous state (optional) or just write
    queryCache.set(['todos'], (old) => [...old, newTodo]);

    // 2. Perform mutation
    await api.post('/todos', newTodo);

    // 3. Revalidate to ensure server consistency
    queryCache.invalidate(['todos']);
};
```

## Infinite Scroll UI
Simple implemention with a "Load More" button.

```tsx
function PostList() {
    const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey: ['posts'],
        queryFn: ({ pageParam }) => fetchPosts(pageParam),
        getNextPageParam: (lastPage) => lastPage.nextCursor
    });

    if (!data) return <Skeleton />;

    return (
        <div>
            {data.pages.map(page => (
                page.items.map(post => <Post key={post.id} data={post} />)
            ))}
            <button 
                onClick={() => fetchNextPage()} 
                disabled={!hasNextPage}
            >
                {hasNextPage ? 'Load More' : 'No More Data'}
            </button>
        </div>
    );
}
```
