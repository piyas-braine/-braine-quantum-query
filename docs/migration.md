# Migrating from RTK Query

Quantum Query is designed to be simpler and lighter than RTK Query. Here is how concepts map.

## Core Concepts

| RTK Query | Quantum Query |
| :--- | :--- |
| `createApi` | *Not needed*. Just use `queryCache` or hooks directly. |
| `endpoints` | Just `async` functions. |
| `useGetXQuery` | `useQuery({ queryKey: ['x'], queryFn: ... })` |
| `tagTypes` / `providesTags` | `queryKey` (arrays) |
| `invalidatesTags` | `queryCache.invalidate(['key'])` |

## Example Refactor

**RTK Query**:
```typescript
const api = createApi({
    baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
    endpoints: (builder) => ({
        getTodo: builder.query({
            query: (id) => `todo/${id}`,
        }),
    }),
});
```

**Quantum Query**:
```typescript
// Define a fetcher
const fetchTodo = (id) => fetch(`/api/todo/${id}`).then(r => r.json());

// Use it
const { data } = useQuery({
    queryKey: ['todo', id],
    queryFn: () => fetchTodo(id)
});
```

## Why Switch?
- **Bundle Size**: Save ~50KB (No Redux required).
- **Flexibility**: Use any fetcher (fetch, axios, ky).
- **Simplicity**: No boilerplate "slice" setup.
