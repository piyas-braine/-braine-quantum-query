# useMutation

Hook to mutate data on the server.

```tsx
const mutation = useMutation(options)
```

## Options

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`mutationFn`** | \`(variables) => Promise&lt;T&gt;\` | **Required** | The mutation function. |
| **`mutationKey`** | \`unknown[]\` | - | Optional key (useful for devtools). |
| **`onMutate`** | \`(variables) => Promise&lt;Context&gt;\` | - | Fired before mutationFn. Useful for optimistic updates. |
| **`onSuccess`** | \`(data, variables, context)\` | - | Fired on success. |
| **`onError`** | \`(err, variables, context)\` | - | Fired on error. |
| **`onSettled`** | \`(data, err, variables)\` | - | Fired on success or error. |
| **`optimistic`** | \`object\` | - | Declarative optimistic update config. |

### Optimistic Config
```ts
{
  queryKey: ['key'],
  update: (variables, oldData) => newData
}
```

## Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| **`mutate`** | \`(variables) => void\` | Trigger the mutation. |
| **`mutateAsync`** | \`(variables) => Promise&lt;T&gt;\` | Trigger and await the result. |
| **`data`** | \`T\` | The response data. |
| **`error`** | \`Error\` | The error object. |
| **`isLoading`** | \`boolean\` | True if mutation is in flight. |
| **`status`** | \`'idle' \| 'pending' \| 'success' \| 'error'\` | Current status. |
| **`reset`** | \`() => void\` | Reset state to 'idle'. |
