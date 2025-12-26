# Mutations & Optimistic Updates

Mutating data is where state management usually gets messy. We made it declarative.

## Basic Mutation

```tsx
const mutation = useMutation({
    mutationFn: (newTodo) => axios.post('/todos', newTodo),
    onSuccess: () => {
       // Refetch the list to see the new item
       client.invalidate(['todos']);
    }
});
```

## The "Optimistic" Config 🚀
Other libraries force you to write generic imperative code to handle optimistic updates (cancel queries, snapshot data, set new data, handle error, rollback).

We built a dedicated API for it.

```tsx
const mutation = useMutation({
    mutationFn: (text: string) => api.post('/todos', { text }),

    // Declarative Optimistic UI
    optimistic: {
        queryKey: ['todos'], // 1. Which query to update?
        
        // 2. How to update it? (Pure function)
        update: (variables, oldData) => {
            return [...oldData, { id: 'temp', text: variables, pending: true }];
        }
    }
});
```

**What happens automatically:**
1.  **Cancel**: In-flight fetches for `['todos']` are cancelled.
2.  **Snapshot**: The old state is saved securely.
3.  **Update**: Your `update` function runs and the UI updates *instantly*.
4.  **Error**: If the network request fails, we **auto-rollback** to the snapshot.
5.  **Settled**: We re-fetch `['todos']` to ensure consistency.

**Zero imperative boilerplate.**
