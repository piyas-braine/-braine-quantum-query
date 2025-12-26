# Tag-Based Invalidation

Most query libraries use fuzzy string matching (prefix matching) to invalidate queries. While simple, this becomes a performance bottleneck in large applications.

Quantum Query introduces **O(1) Tag-Based Invalidation**.

## The Problem with Prefix Matching
Imagine you have 1,000 queries for individual "Posts". To invalidate them all in TanStack Query, you might do `queryClient.invalidateQueries(['posts'])`. The library must iterate through all 1,000 keys to find matches.

## The Quantum Solution: Tag Indexing
Quantum Query maintains an internal `Map<string, Set<string>>` that indexes query keys by tags. This allows for constant-time lookups.

### 1. Assign Tags to Queries
```typescript
useQuery({
  queryKey: ['post', id],
  queryFn: () => fetchPost(id),
  // Assign tags for grouping
  tags: ['posts', `post-${id}`], 
});
```

### 2. Invalidate by Tag
Instead of matching strings, you target the index directly.

```typescript
const client = useQueryClient();

const mutation = useMutation({
  mutationFn: updatePost,
  onSuccess: () => {
    // Instant lookup. No iteration over the entire cache.
    client.invalidateTags(['posts']); 
  }
});
```

## When to use Tags vs. Keys?

| Scenario | Use Keys | Use Tags |
| :--- | :---: | :---: |
| Invalidating a single specific item | ✅ | - |
| Invalidating a logical group (e.g., "all items in list") | - | ✅ |
| Complex overlapping groups | - | ✅ |
| High-frequency updates in large caches | - | ✅ |

> [!TIP]
> Use tags for "Mass Invalidation". Use keys for "Surgical Invalidation" of specific resources.
