import React, { Suspense } from 'react';
import { createState, useStore } from '../index';

// --- API Mocks ---
const api = {
    get: () => new Promise<string[]>(r => setTimeout(() => r(['Apple', 'Banana']), 500)),
    post: (item: string) => new Promise<void>(r => setTimeout(r, 500)),
    delete: (item: string) => new Promise<void>(r => setTimeout(r, 500)),
};

// --- Store ---
const todoStore = createState({
    items: api.get(), // Start fetching immediately
    newItem: '',
    isSaving: false,

    // Actions
    async add() {
        if (!this.newItem) return;

        this.isSaving = true; // Loading state for button
        try {
            await api.post(this.newItem);
            this.newItem = '';
            // Re-fetch to update list
            this.items = api.get();
        } finally {
            this.isSaving = false;
        }
    },

    async remove(item: string) {
        // For delete, we can maybe show a "deleting..." state locally?
        // Or just block UI.
        await api.delete(item);
        this.items = api.get();
    }
});

// --- Components ---

export function TodoApp() {
    const snap = useStore(todoStore);

    return (
        <div className="p-4 border rounded">
            <h1>Grocery List</h1>

            {/* Input State */}
            <div className="flex gap-2 mb-4">
                <input
                    value={snap.newItem}
                    onChange={(e) => todoStore.newItem = e.target.value}
                    disabled={snap.isSaving}
                    className="border p-1"
                />
                <button
                    onClick={() => todoStore.add()}
                    disabled={snap.isSaving}
                >
                    {snap.isSaving ? 'Saving...' : 'Add'}
                </button>
            </div>

            {/* Async List with Suspense */}
            <Suspense fallback={<div>Loading list...</div>}>
                <TodoList />
            </Suspense>
        </div>
    );
}

function TodoList() {
    // This component will suspend if `todoStore.items` is pending
    const snap = useStore(todoStore);

    return (
        <ul>
            {/* The proxy unwraps the promise, so at runtime this is an array. TypeScript doesn't know that yet. */}
            {(snap.items as unknown as string[]).map(item => (
                <li key={item}>
                    {item}
                    <button onClick={() => todoStore.remove(item)} className="ml-2 text-red-500">
                        x
                    </button>
                </li>
            ))}
        </ul>
    );
}
