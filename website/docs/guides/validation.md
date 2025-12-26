# Schema-First Validation

Quantum Query treats data integrity as a first-class citizen. Unlike other libraries where validation is an afterthought handled manually in hooks, Quantum Query integrates validation directly into the fetch/cache cycle.

## Why Validate at the Edge?

1.  **Type Safety**: Ensure the data in your cache matches your TypeScript interfaces.
2.  **Graceful Failure**: Catch API contract breakages before they crash your UI.
3.  **Sanitization**: Strip out unexpected properties from large API responses.

## Using with Zod

We recommend [Zod](https://zod.dev/) for schema definition, but any library with a `.parse()` method will work.

```typescript
import { z } from 'zod';
import { useQuery } from '@braine/quantum-query';

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;

function UserProfile({ id }) {
  const { data } = useQuery({
    queryKey: ['user', id],
    queryFn: () => fetch(`/api/users/${id}`).then(res => res.json()),
    // Integrated Validation
    schema: UserSchema, 
  });

  return <div>{data?.username}</div>;
}
```

## Global Validation

You can define a default schema for your entire `QueryClient`. This is useful for standard API envelopes.

```typescript
const client = new QueryClient({
  defaultSchema: GlobalResponseSchema,
});
```

## How it Works

When a `schema` is provided:
1.  The `QueryRemotes` layer fetches the raw data.
2.  The `QueryClient` runs `schema.parse(data)` before updating the storage.
3.  If validation fails, the query enters an `error` state with a `ZodError`, preventing corrupted data from entering your application state.
