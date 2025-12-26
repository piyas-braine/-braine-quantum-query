# Smart Models

**Smart Models** are our answer to "where do I put my business logic?".

They combine:
1.  **State** (Reactive Signals)
2.  **Computed Properties** (Derived Signals)
3.  **Actions** (Methods)

...into a single, testable, class-like entity.

## The TodoModel Example

Let's build a full featured Todo list logic in *one* file.

```tsx
import { defineModel } from '@braine/quantum-query';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export const TodoModel = defineModel({
  // 1. Initial State
  state: {
    items: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
    isLoading: false
  },

  // 2. Computed (Auto-memoized)
  computed: {
    // Only re-runs if 'items' or 'filter' changes
    visibleTodos() {
      if (this.filter === 'all') return this.items;
      if (this.filter === 'active') return this.items.filter(t => !t.done);
      return this.items.filter(t => t.done);
    },
    
    stats() {
      const total = this.items.length;
      const completed = this.items.filter(t => t.done).length;
      return { total, completed, active: total - completed };
    }
  },

  // 3. Actions
  actions: {
    add(text: string) {
      this.items.push({ 
        id: crypto.randomUUID(), 
        text, 
        done: false 
      });
    },
    
    toggle(id: string) {
      const todo = this.items.find(t => t.id === id);
      if (todo) todo.done = !todo.done;
    },
    
    async loadFromServer() {
      this.isLoading = true;
      const data = await fetch('/api/todos').then(r => r.json());
      this.items = data; // Batch update
      this.isLoading = false;
    }
  }
});
```

## Consuming in React

Use the \`useStore\` hook to bind to the model.

```tsx
import { useStore } from '@braine/quantum-query';
import { TodoModel } from './models/todos';

function TodoApp() {
  // Subscribes ONLY to accessed properties (visibleTodos, stats)
  const store = useStore(TodoModel);

  return (
    <div>
      <h1>Todos ({store.stats.active} left)</h1>
      
      <ul>
        {store.visibleTodos.map(todo => (
          <li key={todo.id} onClick={() => store.toggle(todo.id)}>
             {todo.text} {todo.done ? '✅' : ''}
          </li>
        ))}
      </ul>

      <button onClick={() => store.loadFromServer()}>
        {store.isLoading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  );
}
```
