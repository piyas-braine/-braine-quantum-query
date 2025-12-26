import { describe, it, expect, vi } from 'vitest';
import { createState } from '../src/store/proxy';
import { computed } from '../src/store/computed';

// Mock API
const DB = {
    todos: [{ id: 1, text: 'Buy Milk' }]
};

const API = {
    async getTodos() {
        await new Promise(r => setTimeout(r, 10));
        return [...DB.todos];
    },
    async retryTodos() {
        return [...DB.todos, { id: 3, text: 'Retry item' }];
    },
    async addTodo(text: string) {
        await new Promise(r => setTimeout(r, 10));
        const newTodo = { id: Date.now(), text };
        DB.todos.push(newTodo);
        return newTodo;
    },
    async removeTodo(id: number) {
        await new Promise(r => setTimeout(r, 10));
        DB.todos = DB.todos.filter(t => t.id !== id);
    }
};

describe('CRUD Flow with Async State', () => {
    it('should handle a full lifecycle', async () => {
        // 1. Setup Store
        const store = createState({
            todos: null as any,
            input: '',

            // Actions
            fetch() {
                this.todos = API.getTodos();
            },
            async add() {
                if (!this.input) return;
                await API.addTodo(this.input);
                this.input = ''; // Clear input
                this.fetch(); // Refetch
            },
            async remove(id: number) {
                // Optimistic update?
                // Hard to do nicely if 'todos' is a promise.
                // Let's do simple Refetch.
                await API.removeTodo(id);
                this.fetch();
            }
        });

        // 2. Initial Fetch
        store.fetch();

        // Check it's a promise (internal check, user sees Suspense)
        // In tests, accessing store.todos will THROW if we don't handle it.

        // Helper to safety-check value in test
        const getSafe = () => {
            try { return store.todos; } catch (e) { return 'SUSPENDED'; }
        };

        expect(getSafe()).toBe('SUSPENDED');

        // Wait for resolve
        await new Promise(r => setTimeout(r, 20));

        expect(Array.isArray(store.todos)).toBe(true);
        expect(store.todos).toHaveLength(1);
        expect(store.todos[0].text).toBe('Buy Milk');

        // 3. Input State (Sync)
        store.input = 'Walk Dog';
        expect(store.input).toBe('Walk Dog');

        // 4. Add Item (POST)
        await store.add();

        expect(store.input).toBe(''); // Cleared
        expect(getSafe()).toBe('SUSPENDED'); // Refetching

        await new Promise(r => setTimeout(r, 20));
        expect(store.todos).toHaveLength(2);
        expect(store.todos[1].text).toBe('Walk Dog');

        // 5. Remove Item (DELETE)
        await store.remove(1);

        await new Promise(r => setTimeout(r, 20));
        expect(store.todos).toHaveLength(1);
        expect(store.todos[0].text).toBe('Walk Dog');
    });
});
