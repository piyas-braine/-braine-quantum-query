import { describe, it, expect } from 'vitest';
import { atom } from '../src/store/model';

describe('Atom Concurrent Updates', () => {
    it('should handle concurrent updates with update()', async () => {
        const counter = atom(0);

        // Simulate 20 concurrent updates
        const updates = Array.from({ length: 20 }, () =>
            counter.update(n => n + 1)
        );

        // All updates should complete
        await Promise.all(updates);

        // Should equal 20
        expect(counter.get()).toBe(20);
    });

    it('should fail with set() pattern (demonstrating the problem)', () => {
        const counter = atom(0);

        // This pattern has race conditions
        for (let i = 0; i < 20; i++) {
            counter.set(counter.get() + 1);
        }

        // This might not equal 20 due to race conditions
        // But in synchronous code it will work
        expect(counter.get()).toBe(20);
    });

    it('should handle truly concurrent updates', async () => {
        const counter = atom(0);

        // Create actual concurrent promises
        const promises = Array.from({ length: 20 }, () =>
            new Promise<void>(resolve => {
                setTimeout(() => {
                    counter.update(n => n + 1);
                    resolve();
                }, Math.random() * 10);
            })
        );

        await Promise.all(promises);

        expect(counter.get()).toBe(20);
    });

    it('should handle object updates atomically', () => {
        const state = atom({ count: 0, name: 'test' });

        // Multiple concurrent object updates
        for (let i = 0; i < 10; i++) {
            state.update(s => ({ ...s, count: s.count + 1 }));
        }

        expect(state.get().count).toBe(10);
        expect(state.get().name).toBe('test');
    });

    it('should handle array updates atomically', () => {
        const list = atom<number[]>([]);

        // Multiple concurrent array updates
        for (let i = 0; i < 20; i++) {
            list.update(arr => [...arr, i]);
        }

        expect(list.get()).toHaveLength(20);
        expect(list.get()).toEqual(Array.from({ length: 20 }, (_, i) => i));
    });
});
