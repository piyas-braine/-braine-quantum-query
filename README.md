# Quantum Query ⚡️

> **State Management at the Speed of Light.**

[![npm version](https://img.shields.io/npm/v/@braine/quantum-query.svg)](https://www.npmjs.com/package/@braine/quantum-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Quantum Query** is a high-performance, signal-based state management library for React. It combines the ease of use of Async Querying with the surgical precision of O(1) Signal Reactivity.

---

## 📚 Documentation
- **[Introduction](docs/introduction/overview.md)**: Why Signals beat Selectors.
- **[Getting Started](docs/introduction/getting-started.md)**: Installation & Quick Start.
- **[Mental Model](docs/concepts/mental-model.md)**: Unifying Server & Client State.
- **[Mutations](docs/guides/mutations.md)**: Declarative Optimistic UI.
- **[Smart Models](docs/concepts/mental-model.md#smart-models-advanced)**: Domain Logic Patterns.

---

## Why Quantum?

| Feature | The Old Way (React Query / RTK) | The Quantum Way |
| :--- | :--- | :--- |
| **Reactivity** | Pull-based (Selectors check on every render) | **Push-based** (Signals notify subscribers directly) |
| **Complexity** | O(n) - Grows with app size | **O(1)** - Constant time updates |
| **Updates** | Component Re-render | **Fine-grained** (often sub-component) |
| **Boilerplate** | Providers, Stores, Reducers | **Zero** (Import & Go) |

## Quick Look

```tsx
import { useQuery } from '@braine/quantum-query';

// 1. Surgical Reads (Auto-Memoized)
const { data } = useQuery({
    queryKey: ['user', 1],
    queryFn: fetchUser
});

// 2. Declarative Mutations (Auto-Rollback)
const { mutate } = useMutation({
    mutationFn: updateUser,
    optimistic: {
        queryKey: ['user', 1],
        update: (vars, old) => ({ ...old, name: vars.name })
    }
});
```

## Fine-Grained Reactivity (Signals)

The killer feature of Quantum Query is **`useQuerySignal`**. Unlike standard hooks that re-render your component on every data change, `useQuerySignal` returns a stable reactive object.

```tsx
import { useQuerySignal } from '@braine/quantum-query';

function StockTicker({ symbol }) {
  // This component will NEVER re-render when price changes!
  const signal = useQuerySignal({
    queryKey: ['stock', symbol],
    queryFn: fetchStockPrice,
    refetchInterval: 1000
  });

  return (
    <div>
      <h3>{symbol}</h3>
      {/* The text node updates directly via Signal binding */}
      <p>Price: ${signal.value?.data?.price}</p>
    </div>
  );
}
```

## License
MIT
