import { describe, it, expect, vi } from 'vitest';
import { createState } from '../src/store/proxy';
import { scheduleUpdate } from '../src/store/scheduler';

describe('createState', () => {
    it('should be reactive', async () => {
        const store = createState({ count: 0 });
        const listener = vi.fn();

        // Simulate active listener
        const { setActiveListener } = await import('../src/store/proxy');
        setActiveListener(listener);

        // Access property to subscribe
        const _ = store.count;
        setActiveListener(null);

        // Mutate
        store.count++;

        expect(listener).toHaveBeenCalled();
    });

    it('should handle async promises', async () => {
        const store = createState({ data: null as any });

        const p = new Promise(r => setTimeout(() => r('hello'), 10));
        const listener = vi.fn();

        // Assign promise
        // We expect this to trigger an update when it resolves
        // Can we track the promise assignment?
        // Accessing `store` to attach listener to "data" key is hard if it's new property.
        // But `store.data` exists.

        const { setActiveListener } = await import('../src/store/proxy');
        setActiveListener(listener);
        const _ = store.data; // subscribe to 'data'
        setActiveListener(null);

        store.data = p; // Should notify because value changed
        expect(listener).toHaveBeenCalledTimes(1);

        // Wait for resolve
        await p;
        await new Promise(r => setTimeout(r, 0)); // Microtasks

        // Should notify again when promise resolves?
        // The promise handling logic calls `triggerUpdate` which calls listeners.
        expect(listener).toHaveBeenCalledTimes(2);

        // Check unwrapping
        expect(store.data).toBe('hello');
    });
});
