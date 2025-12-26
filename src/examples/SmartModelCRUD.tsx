import React from 'react';
import { defineModel } from '../store/model';
import { useStore } from '../react/autoHook';

// 1. Define Model
export const CrudModel = defineModel({
    state: {
        items: [] as string[],
        inputText: '',
        status: 'idle' // idle | saving | error
    },

    computed: {
        isValid() {
            return this.inputText.length > 0;
        },
        count() {
            return this.items.length;
        }
    },

    actions: {
        setInput(val: string) {
            this.inputText = val;
        },

        // Async Action (Optimistic)
        async add() {
            if (!this.isValid) return;

            const text = this.inputText;

            // 1. Optimistic Update
            this.items.push(text);
            this.inputText = ''; // Clear input immediately
            this.status = 'saving';

            // 2. Simulate API Call
            try {
                await new Promise(r => setTimeout(r, 50)); // Fake network
                this.status = 'idle';
            } catch (e) {
                // Rollback
                this.items = this.items.filter(i => i !== text);
                this.inputText = text; // Restore input
                this.status = 'error';
            }
        },

        async delete(text: string) {
            this.items = this.items.filter(i => i !== text);
        }
    }
});

// 2. React UI
export function CrudApp() {
    const model = useStore(CrudModel);

    return (
        <div>
            <h1>Crud App ({model.count})</h1>

            <div data-testid="status">{model.status}</div>

            <input
                data-testid="input"
                value={model.inputText}
                onChange={e => model.setInput(e.target.value)}
            />

            <button
                data-testid="add-btn"
                disabled={!model.isValid}
                onClick={() => model.add()}
            >
                Add
            </button>

            <ul>
                {model.items.map(item => (
                    <li key={item} data-testid="item">
                        {item}
                        <button data-testid={`delete-${item}`} onClick={() => model.delete(item)}>Delete</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
