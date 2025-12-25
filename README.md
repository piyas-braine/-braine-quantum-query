# @braine/quantum-query

**State Management at the Speed of Light.**
> A unified, signal-based architecture that merges Store, Actions, and API Logic into a single, high-performance ecosystem.

[![npm version](https://img.shields.io/npm/v/@braine/quantum-query.svg)](https://www.npmjs.com/package/@braine/quantum-query)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ⚡️ Why "Quantum"?
Existing libraries (Redux, RTK Query) behave like "Buses". They stop at every station (component) to check if someone needs to get off (re-render via O(n) selectors).

**Quantum-Query** behaves like a teleporter. It updates *only* the specific component listening to a specific property, instantly.

*   **O(1) Reactivity**: Powered by Atomic Signals. Zero selectors. No "Top-Down" re-renders.
*   **Zero Boilerplate**: No reducers, no providers, no slices, no thunks.
*   **Enterprise Ecosystem**: Persistence, Plugins, Deduplication, and Validation included.

---

## 📦 Installation

```bash
npm install @braine/quantum-query
```

---

## 🚀 Quick Start (React Hooks)

If you just want to fetch data, it works exactly like you expect.

```typescript
import { useQuery } from '@braine/quantum-query';

function UserProfile({ id }) {
    const { data, isLoading } = useQuery({
        queryKey: ['user', id],
        queryFn: () => fetch(`/api/user/${id}`).then(r => r.json()),
        staleTime: 5000 // Auto-cache for 5s
    });

    if (isLoading) return <div>Loading...</div>;
    return <div>Hello, {data.name}!</div>;
}
```

---

## 🧠 The "Smart Model" Pattern (Advanced)

Stop splitting your logic between Redux (Client State) and React Query (Server State). **Smart Models** combine state, computed properties, and actions into one reactive entity.

### 1. Define Model
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
    },
    isEmpty() {
      return this.items.length === 0;
    }
  },

  // 3. Actions (Sync + Async + Optimistic)
  actions: {
    add(text: string) {
      this.items.push(text); // Direct mutation (proxied)
    },
    async save() {
       await api.post('/todos', { items: this.items });
    }
  }
});
```

### 2. Use Model
```tsx
import { useStore } from '@braine/quantum-query';
import { TodoModel } from './models/TodoModel';

function TodoApp() {
  // auto-subscribes ONLY to properties accessed in this component
  const model = useStore(TodoModel); 

  return (
    <div>
      <h1>Active: {model.activeCount}</h1>
      <button onClick={() => model.add("Ship it")}>Add</button>
    </div>
  );
}
```

---

## 🌐 Enterprise HTTP Client

We built a fetch wrapper that matches **RTK Query** in power but keeps **Axios** simplicity. It includes **Automatic Deduplication** and **Retries**.

```typescript
import { createHttpClient } from '@braine/quantum-query';

export const api = createHttpClient({
  baseURL: 'https://api.myapp.com',
  timeout: 5000, 
  retry: { retries: 3 }, // Exponential backoff for Network errors
  
  // Auth Handling (Auto-Refresh)
  auth: {
    getToken: () => localStorage.getItem('token'),
    onTokenExpired: async () => {
        const newToken = await refreshToken();
        localStorage.setItem('token', newToken);
        return newToken; // Automatically retries original request
    }
  }
});

// data is strictly typed!
const user = await api.get<User>('/me');
```

---

## 🔐 Authentication (Built-in)

No more interceptors. We handle token injection and **automatic refresh on 401** errors out of the box.

```typescript
const client = createClient({
  baseURL: 'https://api.myapp.com',
  auth: {
    // 1. Inject Token
    getToken: () => localStorage.getItem('token'),
    
    // 2. Refresh & Retry (Auto-called on 401)
    onTokenExpired: async (client) => {
        const newToken = await refreshToken(); 
        localStorage.setItem('token', newToken);
        return newToken; // Original request is automatically retried
    },
    
    // 3. Redirect on Fail
    onAuthFailed: () => window.location.href = '/login'
  }
});
```

---

## 🛡️ Data Integrity (Runtime Safety)

Don't trust the backend. Validate it. We support **Zod**, **Valibot**, or **Yup** schemas directly in the hook.

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user'])
});

const { data } = useQuery({
   queryKey: ['user'],
   queryFn: fetchUser,
   schema: UserSchema // Throws descriptive error if API returns garbage
});
```

---

## 🔌 Plugin System (Middleware) 🆕

Inject logic into every request lifecycle (Logging, Analytics, Performance Monitoring).

```typescript
import { queryCache } from '@braine/quantum-query';

queryCache.use({
    name: 'logger',
    onFetchStart: (key) => console.log('Fetching', key),
    onFetchError: (key, error) => console.error(`Fetch failed for ${key}:`, error)
});
```

---

## 💾 Persistence Adapter 🆕

Persist your cache to `localStorage` (or IndexedDB/AsyncStorage) automatically. Works offline.

```typescript
import { persistQueryClient, createLocalStoragePersister } from '@braine/quantum-query/persist';

persistQueryClient({
    queryClient: queryCache,
    persister: createLocalStoragePersister(),
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
});
```

---

## 📚 Documentation

*   **[API Reference](docs/api.md)**: Full method signatures and options.
*   **[Recipes](docs/recipes.md)**: Common patterns (Auth, Infinite Scroll, Optimistic UI).
*   **[Migration Guide](docs/migration.md)**: Step-by-step guide from RTK Query / Redux.

---

## 🆚 Comparison

| Feature | RTK Query | TanStack Query | **Quantum-Query** |
| :--- | :--- | :--- | :--- |
| **Architecture** | Redux (Store + Slices) | Observers | **Atomic Signals** ✅ |
| **Boilerplate** | High (Provider + Store) | Medium | **Zero** ✅ |
| **Re-Renders** | Selector-based (O(n)) | Observer-based | **Signal-based (O(1))** ✅ |
| **Smart Models** | ❌ (Requires Redux) | ❌ | **Built-in** ✅ |
| **Bundle Size** | ~17kb | ~13kb | **~3kb** ✅ |
| **Deduplication** | Yes | Yes | **Yes** ✅ |
| **Persistence** | `redux-persist` | Experimental | **Built-in First Class** ✅ |

---

## License
MIT
