# DevTools

Debugging asynchronous state is hard. Quantum DevTools makes it easy with a beautiful, built-in debugging interface.

## Quick Start

```tsx
import { QuantumDevTools } from '@braine/quantum-query';
import { QueryClientProvider } from '@braine/quantum-query';

function App() {
  return (
    <QueryClientProvider client={client}>
      <YourApp />
      
      {/* Add DevTools - automatically excluded in production */}
      {process.env.NODE_ENV === 'development' && <QuantumDevTools />}
    </QueryClientProvider>
  );
}
```

## Features

### 1. Query Explorer 🔍
See every active query in your application with real-time updates.

**Status Indicators**:
- 🟢 **Fresh** - Data is fresh and valid
- 🟡 **Stale** - Data needs refetching
- 🔴 **Error** - Query failed
- 🔵 **Fetching** - Currently loading

**Data Viewer**:
- Inspect full JSON responses
- Expandable/collapsible tree view
- Copy data to clipboard

**Manual Controls**:
- **Refetch** - Manually trigger a refetch
- **Invalidate** - Mark query as stale
- **Reset** - Clear query from cache

### 2. Real-time Updates ⚡
Watch queries update in real-time as your application runs. Perfect for debugging race conditions and understanding data flow.

### 3. Query Metrics 📊
- Total queries cached
- Active vs stale queries
- Cache hit rate
- Memory usage

### 4. Beautiful UI 🎨
- Dark theme optimized for long debugging sessions
- Resizable panel
- Keyboard shortcuts
- Minimal and non-intrusive

## Advanced Usage

### Custom Position

```tsx
<QuantumDevTools 
  position="bottom-right"  // or "bottom-left"
  defaultOpen={false}
/>
```

### Keyboard Shortcuts

- `Cmd/Ctrl + K` - Toggle DevTools
- `Cmd/Ctrl + R` - Refetch all queries
- `Cmd/Ctrl + I` - Invalidate all queries

## Production Builds

DevTools are automatically excluded from production builds via tree-shaking when you use conditional rendering:

```tsx
{process.env.NODE_ENV === 'development' && <QuantumDevTools />}
```

**Bundle Impact**: 0 bytes in production ✅

## Comparison with TanStack DevTools

| Feature | TanStack DevTools | Quantum DevTools |
|---------|-------------------|------------------|
| **Installation** | Separate package | Built-in ✅ |
| **Bundle Size** | ~50KB | ~15KB ✅ |
| **Real-time Updates** | Polling | Signal-based ✅ |
| **Query Metrics** | Basic | Advanced ✅ |
| **Tree-shaking** | Manual | Automatic ✅ |

## Troubleshooting

**DevTools not showing?**
- Ensure you're in development mode (`NODE_ENV=development`)
- Check that `<QuantumDevTools />` is rendered inside your app
- Look for the ⚡ button in the bottom-right corner

**Performance impact?**
- DevTools use Signals, so they have minimal performance impact
- Only active in development
- Automatically tree-shaken in production

