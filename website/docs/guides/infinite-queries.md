# Infinite Queries

Ideal for "Load More" buttons or Infinite Scroll UIs where data is fetched in pages.

## Basic Usage

\`useInfiniteQuery\` works similarly to \`useQuery\` but introduces the concept of pages.

```tsx
import { useInfiniteQuery } from '@braine/quantum-query';

function LoadMorePosts() {
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteQuery({
    queryKey: ['posts'],
    // Page param is passed automatically
    queryFn: ({ pageParam = 1 }) => fetch(\`/api/posts?page=\${pageParam}\`).then(r => r.json()),
    
    // Determine the next page param based on the last page response
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.nextCursor; 
    }
  });

  return (
    <>
      {/* Flatten pages into a single list */}
      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.items.map(post => <PostCard key={post.id} post={post} />)}
        </React.Fragment>
      ))}

      <button 
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'Nothing more to load'}
      </button>
    </>
  );
}
```

## Bi-Directional Infinite Scroll

Quantum Query supports fetching previous pages too, perfect for chat applications.

```tsx
const chatQuery = useInfiniteQuery({
  queryKey: ['chat', roomId],
  queryFn: fetchChatMessages,
  // Cursor for fetching OLDER messages
  getPreviousPageParam: (firstPage) => firstPage.prevCursor, 
  // Cursor for fetching NEWER messages
  getNextPageParam: (lastPage) => lastPage.nextCursor, 
});
```
