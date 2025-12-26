# Getting Started

Welcome to **Quantum Query**. Let's get you set up with the fastest state management library on the planet.

## Installation

```bash
npm install @braine/quantum-query
# or
yarn add @braine/quantum-query
# or
pnpm add @braine/quantum-query
```

## Quick Start
You don't need a Provider. You don't need a store setup. Just import and use.

### 1. Fetching Data
```tsx
import { useQuery } from '@braine/quantum-query';

function UserProfile({ id }: { id: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['user', id],
        queryFn: () => fetch(\`/api/users/\${id}\`).then(r => r.json()),
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    if (isLoading) return <Skeleton />;
    if (error) return <ErrorState error={error} />;
    
    return <h1>{data.name}</h1>;
}
```

### 2. Mutating Data
```tsx
import { useMutation, useQueryClient } from '@braine/quantum-query';

function UpdateName() {
    const client = useQueryClient();
    
    const mutation = useMutation({
        mutationFn: (newName: string) => api.patch('/user', { name: newName }),
        onSuccess: () => {
            // Invalidates 'user' query -> Triggers refetch automatically
            client.invalidate(['user']); 
        }
    });

    return (
        <button onClick={() => mutation.mutate("Antigravity")}>
            {mutation.isLoading ? "Saving..." : "Update Name"}
        </button>
    );
}
```

## Next Steps
- Learn about [Smart Models](../concepts/mental-model.md)
- Configure Global Defaults
- Enable DevTools
