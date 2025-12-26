# useStore

Hook to subscribe to a `createState` proxy or a Smart Model.

```tsx
const state = useStore(store)
```

## Arguments

| Argument | Type | Description |
| :--- | :--- | :--- |
| **`store`** | \`ProxyState\` | The return value of \`createState\` or \`defineModel\`. |

## Behavior
- **Auto-Tracking**: Only properties accessed in the render function are tracked.
- **Batched Updates**: Multiple state changes trigger a single re-render.

## Example

```tsx
const store = createState({ count: 0, text: 'hello' });

function Counter() {
  // Only re-renders when `count` changes.
  // Ignoring `text`.
  const { count } = useStore(store); 
  return <div>{count}</div>
}
```
