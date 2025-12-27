# Fine-Grained Reactivity (The "Ferrari Engine")

Quantum Query allows you to opt-out of React's top-down rendering model for data fetching. By using **Signals**, you can update individual DOM nodes or sub-components without re-rendering the parent component that initiated the fetch.

This is the feature that makes Quantum Query theoretically superior to TanStack Query and standard React hooks.

## The Problem: Render Tearing
In standard libraries (like TanStack Query), `useQuery` is a hook. When the data changes, the hook triggers a re-render of the component calling it.

```tsx
// 🐌 Standard Hook (TanStack Style)
function UserProfile() {
  console.log('Rendered!'); // Fires on 'pending' -> 'success' -> 'isFetching' ...
  const { data } = useQuery({ queryKey: ['user'], queryFn: fetchUser });
  
  if (!data) return <Spinner />;
  return <div>{data.name}</div>;
}
```

If you have a large dashboard with 50 queries, 50 re-renders happen. This causes "jank".

## The Solution: `useQuery$`
The `useQuery$` hook returns a **Signal**, not a value. A signal is a container for a value. Changing the value inside the signal does NOT trigger a React render of the component holding the signal.

```tsx
// ⚡️ Quantum Signal Hook
import { useQuery$, QueryMatch, SignalValue } from '@braine/quantum-query';

function UserProfile() {
  console.log('Rendered!'); // Fires ONCE. Never again.
  const query$ = useQuery$({ queryKey: ['user'], queryFn: fetchUser });
  
  // The DataView component observes the signal directly.
  return (
    <QueryMatch signal={query$} selector={res => res.status}>
        {status => (
            status === 'success' ? 
            // SignalValue renders ONLY this text node when data changes
            <SignalValue signal={query$}>{res => res.data.name}</SignalValue> 
            : <Spinner />
        )}
    </QueryMatch>
  );
}
```

## `QueryMatch` Component
To make this pattern ergonomic, we provide `<QueryMatch>`. It acts like a logic gate that listens to the signal.

```tsx
<QueryMatch 
  signal={query$} 
  selector={result => result.status} // Select what you care about (e.g. status)
>
  {(status) => {
    // This inner function runs only when 'status' changes.
    if (status === 'pending') return <Skeleton />;
    if (status === 'error') return <Error />;
    return <DataView />;
  }}
</QueryMatch>
```

## When to use which?

| Feature | `useQuery` | `useQuery$` |
| :--- | :--- | :--- |
| **Returns** | Value (`TData`) | Signal (`Signal<TData>`) |
| **Re-renders Parent?** | Yes | **No** |
| **Usage** | General Components | High-Performance / Real-time Lists |
| **DX** | Easiest | Advanced |

## Best Practices
Use `useQuery$` when:
1.  You are building a real-time list (stock tickers, chat logs).
2.  You have a heavy Dashboard component that shouldn't re-render just because one widget is loading.
3.  You want to show off 10/10 engineering skills.
