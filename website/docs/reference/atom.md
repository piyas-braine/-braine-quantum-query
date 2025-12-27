# atom

Creates a reactive signal with built-in persistence and schema validation.

```tsx
import { atom } from '@braine/quantum-query';

const user$ = atom({ name: 'Bob' }, {
  key: 'user-data',
  storage: 'local', // or 'session' or CustomStorage
  hydrateSync: false // Default: false (10/10 Performance), set true for testing
});

// Access
console.log(user$.get());

// Update
user$.set({ name: 'Alice' });
```

## Options

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`key`** | \`string\` | - | Unique key for persistence. Required if you want storage. |
| **`storage`** | \`'local' \| 'session' \| StorageAdapter\` | \`'local'\` | Storage engine. Support custom adapters. |
| **`validate`** | \`(data: unknown) => T\` | - | Validate/Transform data on hydration (Schema-first). |
| **`debug`** | \`boolean\` | \`false\` | Enable debug logs for hydration/persistence. |
| **`hydrateSync`** | \`boolean\` | \`false\` | If \`true\`, hydrates synchronously. **Use ONLY for tests** or critical startup data. |

## Async Hydration (Important)

By default, `atom` hydrates **asynchronously** (next microtask) to prevent blocking the main thread during app initialization. This is a "10/10 Engineering" feature.

This means `user$.get()` will return the `initialValue` immediately, and then update with the stored value in the next tick. Your UI should handle this transition (Signals handle it automatically by re-rendering).

## Testing

For testing, use `hydrateSync: true` to ensure values are loaded before your assertions run:

```tsx
const state$ = atom(defaultVal, {
  key: 'test',
  storage: mockStorage,
  hydrateSync: true // Deterministic for tests
});
```
