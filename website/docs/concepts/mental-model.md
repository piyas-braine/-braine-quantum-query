# Mental Model

Most apps suffer from "State Schizophrenia". They split logic between:
1.  **Redux/Zustand** (Client State)
2.  **React Query** (Server State)

These two worlds rarely talk. You end up with synchronization bugs ("Why is my modal open if the user logout failed?").

**Quantum Query** unifies them through a **Clean Architecture** that decouples where data is stored from how it's fetched.

## Architecture Purity

The library is split into three distinct layers:
1. **Remote Layer**: Handles deduplicating identical network requests and automatic retries.
2. **Storage Layer**: A high-performance LRU cache that manages data expiration and Signal lifecycle.
3. **Facade Layer**: The `QueryClient` provides a unified API to orchestrate these layers.

## The Two Types of State

### 1. Server State (Async)
Data you *borrow* from the server.
-   **Source of Truth**: The Database.
-   **Characteristics**: Stale, needs caching, subject to race conditions.
-   **Tool**: `useQuery`.

### 2. App State (Sync)
Data you *own* on the client.
-   **Source of Truth**: The User's actions (right now).
-   **Characteristics**: Instant, temporary, synchronous.
-   **Tool**: `createState` / `useStore`.

## The Bridge 🌉
This is where we shine. You can drive queries *from* your store, and sync query results *into* your store.

### Scenario: The Filterable List
**The Old Way**:
- Component A holds Filter State (React `useState`).
- Component B needs Filter State -> Prop Drill 10 levels down.
- Component C fetches data -> Wraps `useQuery` in `useEffect` to listen to props.

**The Quantum Way**:
1.  **Create a Store** for the UI logic.
    ```ts
    const filters = createState({ status: 'active', search: '' });
    ```
2.  **Bind Query to Store** (Auto-dependency tracking).
    ```ts
    const { data } = useQuery(['items', filters.status], fetchItems);
    ```
    *When `filters.status` changes, the query re-runs automatically.*

## Smart Models (Advanced)
For complex domain logic, use **Smart Models**. This gives you a "Class-like" structure that is 100% reactive.

```typescript
export const TodoModel = defineModel({
  state: { items: [], loading: false },
  
  // Computed (Signal-based memoization)
  computed: {
    count() { return this.items.length }
  },

  // Actions (Async aware)
  actions: {
    async add(text) {
      this.state.loading = true; // Updates UI instantly
      await api.post('/todos', { text });
      this.state.loading = false;
    }
  }
});
```
