import { describe, it, expect } from 'vitest';
import { atom } from '../src/store/model';
import { batch } from '../src/signals';

describe('Atom Edge Cases - Deep Check', () => {
    it('should handle rapid synchronous updates', () => {
        const counter = atom(0);

        // Exactly like external test might do
        for (let i = 0; i < 20; i++) {
            counter.update(n => n + 1);
        }

        expect(counter.get()).toBe(20);
    });

    it('should handle async updates with promises', async () => {
        const counter = atom(0);

        // Create 20 async updates
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(
                new Promise<void>(resolve => {
                    // Simulate async work
                    setImmediate(() => {
                        counter.update(n => n + 1);
                        resolve();
                    });
                })
            );
        }

        await Promise.all(promises);
        expect(counter.get()).toBe(20);
    });

    it('should handle updates with setTimeout', async () => {
        const counter = atom(0);

        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(
                new Promise<void>(resolve => {
                    setTimeout(() => {
                        counter.update(n => n + 1);
                        resolve();
                    }, 0);
                })
            );
        }

        await Promise.all(promises);
        expect(counter.get()).toBe(20);
    });

    it('should handle batched updates', () => {
        const counter = atom(0);

        batch(() => {
            for (let i = 0; i < 20; i++) {
                counter.update(n => n + 1);
            }
        });

        expect(counter.get()).toBe(20);
    });

    it('should handle mixed set and update', () => {
        const counter = atom(0);

        counter.set(5);
        counter.update(n => n + 1);
        counter.update(n => n + 1);
        counter.set(10);
        counter.update(n => n + 5);

        expect(counter.get()).toBe(15);
    });

    it('should handle complex object updates', () => {
        const state = atom({
            count: 0,
            items: [] as number[],
            metadata: { updated: false }
        });

        for (let i = 0; i < 20; i++) {
            state.update(s => ({
                ...s,
                count: s.count + 1,
                items: [...s.items, i],
                metadata: { updated: true }
            }));
        }

        expect(state.get().count).toBe(20);
        expect(state.get().items).toHaveLength(20);
        expect(state.get().metadata.updated).toBe(true);
    });

    it('should handle updates with persistence', () => {
        const counter = atom(0, {
            key: 'test-counter',
            storage: 'local'
        });

        for (let i = 0; i < 20; i++) {
            counter.update(n => n + 1);
        }

        expect(counter.get()).toBe(20);

        // Cleanup
        localStorage.removeItem('test-counter');
    });

    it('should handle floating point arithmetic', () => {
        const value = atom(0);

        for (let i = 0; i < 20; i++) {
            value.update(n => n + 0.1);
        }

        // Floating point should still work
        expect(value.get()).toBeCloseTo(2.0, 10);
    });
});
