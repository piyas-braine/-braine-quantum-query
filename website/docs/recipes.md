# Recipes

## Authentication Middleware
Inject auth tokens into every request using the Plugin System.

```typescript
import { queryCache } from '@braine/quantum-query';

const authPlugin = {
    name: 'auth',
    onFetchStart: (key) => {
        console.log('Fetching', key);
        // Note: Actual headers usually handled in your fetcher,
        // but this is great for logging or analytics.
    },
    onFetchError: (key, error) => {
        if (error.status === 401) {
            logout();
        }
    }
};

queryCache.use(authPlugin);
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
