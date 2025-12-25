# @braine/quantum-query

**State Management at the Speed of Light.**
> A unified architecture that merges Store, Actions, and API Logic into single, high-performance "Smart Models".

[![npm version](https://img.shields.io/npm/v/@braine/quantum-query.svg)](https://www.npmjs.com/package/@braine/quantum-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why "Quantum"?
Existing libraries behave like "Buses". They stop at every station (component) to check if someone needs to get off (re-render).
**Quantum-Query** behaves like a teleporter. It updates *only* the specific component listening to a specific property, instantly.

*   **O(1) Reactivity**: No selectors. No linear scans.
*   **Zero Boilerplate**: No reduces, no thunks, no providers.
*   **Enterprise Grade**: Built-in HTTP client with automatic deduplication, retries, and cancellation.

---

## Installation

```bash
npm install @braine/quantum-query
```

---

## The "Smart Model" Pattern

Stop splitting your logic between Redux (Client) and React Query (Server). Use **Smart Models**.

### 1. Define It
`defineModel` wraps your state, computed properties, and actions into one reactive entity.

```typescript
import { defineModel } from '@braine/quantum-query';

export const TodoModel = defineModel({
  // 1. Unified State
  state: {
    items: [] as string[],
    filter: 'all', 
  },

  // 2. Computed Properties (Auto-Memoized)
  computed: {
    activeCount() {
      return this.items.length;
    }
  },

  // 3. Actions (Sync + Async + Optimistic)
  actions: {
    async add(text: string) {
      // Optimistic Update (Instant UI)
      this.items.push(text);
      
      try {
        await api.post('/todos', { text });
      } catch (err) {
        this.items.pop(); // Auto-Rollback
      }
    }
  }
});
```

### 2. Use It
Just use it.

```tsx
import { useStore } from '@braine/quantum-query';
import { TodoModel } from './models/TodoModel';

function TodoApp() {
  const model = useStore(TodoModel); // Auto-subscribes!

  return (
    <button onClick={() => model.add("Ship it")}>
      Active: {model.activeCount}
    </button>
  );
}
```

---

## Enterprise HTTP Client

We built a fetch wrapper that matches **RTK Query** in power but keeps **Axios** simplicity.

```typescript
import { createHttpClient } from '@braine/quantum-query';

export const api = createHttpClient({
  baseURL: 'https://api.myapp.com',
  timeout: 5000, 
  retry: { retries: 3 }, // Exponential backoff for 5xx/Network errors
  
  // Auth Handling
  auth: {
    getToken: () => localStorage.getItem('token'),
    onTokenExpired: async () => {
        const newToken = await refreshToken();
        localStorage.setItem('token', newToken);
        return newToken; // Automatically retries original request
    }
  }
});

// Automatic Deduplication
// If 5 components call this at once, only 1 request is sent!
const users = await api.get('/users');
```

---

## Data Integrity (Runtime Safety)

Don't trust the backend. Validate it. We support **Zod**, **Valibot**, or **Yup** directly.

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string()
});

// 1. Runtime Validation: Throws error if API returns garbage
// 2. Auto-Typing: 'user' is inferred as { id: string, name: string }
const user = await api.get('/me', { 
  schema: UserSchema 
});
```

---

## Comparison

| Feature | Redux Toolkit | TanStack Query | **Quantum-Query** |
| :--- | :--- | :--- | :--- |
| **Philosophy** | Reducers + Thunks | Server Cache Only | **Unified Smart Models** |
| **Boilerplate** | High | Medium | **Zero** |
| **Performance** | O(N) Selectors | Good | **O(1) Direct Access** |
| **Deduplication**| Yes | Yes | **Yes** |
| **Bundle Size** | Heavy | Medium | **Tiny (<5kb)** |

## License
MIT
# -braine-quantum-query
