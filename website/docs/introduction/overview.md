# Why Quantum Query?

Most state management libraries make you choose: **Ease of Use** (Context) or **Performance** (Selectors).

Quantum Query gives you both.

## The "Ferrari" Engine 🏎️

The core difference is our **Architecture**.

### Traditional Libraries (The Bus) 🚌
Redux, Zustand, and TanStack Query use a "Pull" model.
1.  **Change**: Ideally, one thing changes.
2.  **Notify**: The store yells at **everyone**. "HEY! SOMETHING CHANGED!"
3.  **Check**: Every single component runs a `selector` function. "Is it for me? No. Is it for me? No."
4.  **Render**: Finally, the right component updates.

This is **O(n)** complexity. As your app grows, it gets slower.

### Quantum Query (The Teleporter) ⚡️
We use **Atomic Signals**.
1.  **Change**: A signal changes.
2.  **Update**: The signal teleports the update **directly** to the subscribed component.
3.  **Done**.

This is **O(1)** complexity. It doesn't matter if you have 10 components or 10,000. The performance is constant.

## The "Bridge" 🌉

Usually, you need two libraries:
1.  **Server State**: React Query (Caching, Deduplication)
2.  **Client State**: Redux/Zustand (Global Store, UI State)

Quantum Query unifies them.

- **Queries** are just asynchronous signals.
- **Stores** are just synchronous signals.

They share the same engine. You can use `useQuery` for your API and `defineModel` for your Todo list, and they work seamlessly together.

## Zero Boilerplate 🛠️

We hate boilerplate as much as you do.

**Redux**:
- Actions, Reducers, Types, Middleware, Providers, Selectors... 🤯

**Quantum Query**:
```tsx
// 1. Define
const count = createSignal(0);

// 2. Use
const value = count.value; // Auto-subscribes!
```

## Feature Comparison

| Feature | RTK Query | TanStack Query | Quantum-Query |
| :--- | :--- | :--- | :--- |
| **Architecture** | Redux (Store + Slices) | Observers | **Atomic Signals** ✅ |
| **Boilerplate** | High (Provider + Store) | Medium | **Zero** ✅ |
| **Re-Renders** | Selector-based (O(n)) | Observer-based | **Signal-based (O(1))** ✅ |
| **Smart Models** | ❌ (Requires Redux) | ❌ | **Built-in** ✅ |
| **Bundle Size** | ~17kb | ~13kb | **~1kb (Core) / ~9kb (Full)** ✅ |
| **Deduplication** | Yes | Yes | **Yes** ✅ |
| **Persistence** | redux-persist | Experimental | **Built-in First Class** ✅ |

## The Bottom Line

If you want the industry standard, use TanStack Query.
If you want **state management at the speed of light**, use Quantum Query.
