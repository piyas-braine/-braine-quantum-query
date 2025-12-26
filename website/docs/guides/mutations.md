# Mutations

Mutations are used for creating, updating, or deleting data. Unlike queries, they are not automatic; you trigger them imperativey.

## Basic Mutation

```tsx
import { useMutation, useQueryClient } from '@braine/quantum-query';

function CreateTodo() {
  const client = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: (newTodo: { title: string }) => {
      return axios.post('/todos', newTodo);
    },
    onSuccess: () => {
      // Invalidate and refetch
      client.invalidateTags(['todos']);
    },
    onError: (error) => {
      toast.error(\`Failed: \${error.message}\`);
    }
  });

  return (
    <button 
      disabled={mutation.isLoading}
      onClick={() => mutation.mutate({ title: 'Do Laundry' })}
    >
      Add Todo
    </button>
  );
}
```

## Optimistic Updates (Declarative) 🚀

Quantum Query provides a unique, declarative API for optimistic updates. You don't need to write imperative code to manage the cache rollback.

```tsx
useMutation({
  mutationFn: (newTitle: string) => api.updateTitle(id, newTitle),
  
  // The "Magic" Config
  optimistic: {
    // 1. Which query are we modifying?
    queryKey: ['post', id],
    
    // 2. How should it look immediately?
    update: (newTitle, oldPost) => ({
      ...oldPost,
      title: newTitle, // Apply change instantly
      isOptimistic: true
    }),
  }
});
```

### What happens under the hood?
1.  **Cancel**: Any outgoing fetches for `['post', id]` are cancelled.
2.  **Snapshot**: We save the current state of `['post', id]`.
3.  **Apply**: We apply your `update` function to the cache. **UI updates instantly.**
4.  **Request**: The `mutationFn` runs.
5.  **Error?**: If it fails, we **automatically rollback** to the Snapshot.
6.  **Success?**: We replace the optimistic data with the real server response.

## Side Effects

You can chain side effects for granular control.

```tsx
useMutation({
  mutationFn: deleteUser,
  onMutate: async (userId) => {
    // Run before mutation
    console.log('Deleting', userId);
  },
  onSuccess: (data, variables) => {
    // Run after success
    navigate('/users');
  },
  onSettled: () => {
    // Run after success OR error
    console.log('Done');
  }
});
```
