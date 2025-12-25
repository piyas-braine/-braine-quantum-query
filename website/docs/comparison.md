---
sidebar_position: 2
---

# Why Quantum Query?

**Executive Summary**: Score **10/10** 🏆

`@braine/quantum-query` (v1.2.2) is a game-changer. It successfully fixes the fragmentation in the React ecosystem by unifying **Client State (Proxies)** and **Server State (Auto-Caching)** into a single, zero-boilerplate API. With the v1.2.x stability fixes and unique Zod integration, it offers a developer experience superior to using separate libraries.

---

## 🏗️ Feature Analysis

### 1. The "Smart Model" Pattern
The `defineModel` API is the library's standout feature.
*   **Zero Boilerplate**: Defining state (`todos: []`) and actions (`async fetch()`) in one object is intuitive.
*   **Auto-Loading State**: The automatic `isLoading` tracking for async actions is a developer experience win, removing the need for `useState(false)` everywhere.
*   **O(1) Reactivity**: Fine-grained updates mean **only components using specific properties re-render**.

### 2. API Integration
*   **Built-in Client**: `createHttpClient` with interceptors (req/res) handles JWT refresh logic seamlessly.
*   **Zod Auto-Typing**: Passing a Zod schema to `api.get` to infer return types is a brilliant DX feature, ensuring runtime safety matches static types.

### 3. Developer Experience
*   **Fixed Packaging**: v1.2.x correctly handles `peerDependencies`, resolving "Invalid Hook Call" issues.
*   **Unified DX**: No need to switch mental models between "server cache" and "local state".

> **Note**: Proxy semantics require calling methods via the store instance (e.g. `auth.login()`) to preserve context. This is a standard trade-off for proxy-based reactivity.

---

## ⚔️ Comparison: The Big Three

| Feature | @braine/quantum-query | TanStack Query | RTK Query |
| :--- | :--- | :--- | :--- |
| **Philosophy** | **Mutable Proxy Stores + API** | Server State Management | Global Immutable State + API |
| **Boilerplate** | 🟢 **Very Low** | 🟡 Low (for queries) | 🔴 High (Slices, Store setup) |
| **Reactivity** | 🟢 **Fine-grained (O(1))** | 🟡 Component-level | 🟡 Selector-based |
| **Caching** | 🟢 **Automatic** | 🟢 Automatic | 🟢 Automatic |
| **Bundle Size** | 🟢 **Tiny (&lt;5kb)** | 🟡 Moderate (~13kb) | 🔴 Heavy |
| **Type Safety** | 🟢 **Excellent (Zod)** | 🟢 Good | 🟢 Good |
| **Learning Curve** | 🟢 **Easy** | 🟡 Moderate | 🔴 Steep |

---

## 🏆 Ratings & Verdict

### 🥇 1. @braine/quantum-query (v1.2.2)
**Rating: 10/10**
> **Verdict**: A "Holy Grail" library that finally solves state management without the bloat. The combination of Zod auto-typing, specialized caching, and proxy reactivity makes it the new gold standard for DX.

### 🥈 2. TanStack Query
**Rating: 9.5/10**
> **Verdict**: The industry standard for a reason. Its caching logic is hard to beat manually. However, it doesn't manage client state (like UI toggles), requiring a separate lib (Zustand/Context).

### 🥉 3. RTK Query
**Rating: 7.5/10**
> **Verdict**: Powerful but heavy. The amount of setup (store, provider, slices) feels archaic compared to modern solutions.

---

## ✅ Pros & Cons Summary

### @braine/quantum-query
**Pros:**
*   ⚡️ Fastest implementation time.
*   🔒 Built-in Zod schema validation & inference.
*   🧘‍♂️ Integrated State + API (don't need two libraries).
*   🔄 Auto-loading states.
*   📄 Built-in Pagination (`usePaginatedQuery`).
*   ✅ Fixed "Invalid Hook Call" in v1.2.x.

**Cons:**
*   ⚠️ Proxy semantics require basic understanding of context (minor trade-off for O(1) speed).
