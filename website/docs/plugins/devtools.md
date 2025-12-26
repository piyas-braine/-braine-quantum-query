# DevTools

Debugging asynchronous state is hard. Quantum DevTools makes it easy.

## Setup

First, install the devtools package (it's bundled with the main package but good to be explicit).

```tsx
import { QuantumDevTools } from '@braine/quantum-query/devtools';
import { QueryClientProvider } from '@braine/quantum-query';

function App() {
  return (
    <QueryClientProvider client={client}>
      <YourApp />
      
      {/* Add this at the root */}
      <QuantumDevTools 
        openByDefault={false} 
        position="bottom-right" 
      />
    </QueryClientProvider>
  );
}
```

## Features

### 1. The Query Explorer
See every active query in your application.
- **Status Indicators**: 🟢 Fresh, 🟡 Stale, 🔴 Error, 🔵 Fetching.
- **Data Viewer**: Inspect the full JSON response.
- **Actions**: "Refetch", "Invalidate", "Reset" buttons for manual control.

### 2. The Signal Graph (Experimental)
Visualize the dependency graph of your signals. See exactly which component is subscribed to which data slice.

## Production
The DevTools are automatically excluded from production builds via tree-shaking, as long as you conditionally render them or your bundler handles \`process.env.NODE_ENV\`.

```tsx
{process.env.NODE_ENV === 'development' && <QuantumDevTools />}
```
