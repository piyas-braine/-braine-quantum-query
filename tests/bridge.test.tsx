import { describe, it, expect, vi } from 'vitest';
import { createSignal } from '../src/addon/signals';
import { createState } from '../src/core/proxy';
import { fromSignal, toSignal } from '../src/core/bridge';

describe('Quantum Bridge (Unification)', () => {
    describe('fromSignal (Signal -> Proxy)', () => {
        it('should reflect signal updates in proxy', () => {
            const signal = createSignal({ count: 0 });
            const proxy = fromSignal(signal);

            expect(proxy.count).toBe(0);

            signal.set({ count: 1 });
            expect(proxy.count).toBe(1);
        });

        it('should handle primitives by boxing', () => {
            const signal = createSignal(10);
            const proxy = fromSignal(signal);

            expect((proxy as any).value).toBe(10);

            signal.set(20);
            expect((proxy as any).value).toBe(20);
        });
    });

    describe('toSignal (Proxy -> Signal)', () => {
        it('should update signal when proxy changes', () => {
            const state = createState({ count: 0 });
            const signal = toSignal(() => state.count);

            expect(signal.get()).toBe(0);

            // Update proxy
            state.count++;

            // Signal should update immediately (synchronous in our implementation)
            expect(signal.get()).toBe(1);
        });

        it('should handle nested proxy dependencies', () => {
            const state = createState({ user: { name: 'Alice' } });

            // Selector accesses nested property
            const nameSignal = toSignal(() => state.user.name);

            expect(nameSignal.get()).toBe('Alice');

            state.user.name = 'Bob';
            expect(nameSignal.get()).toBe('Bob');
        });

        it('should handle complex dependencies', () => {
            const state = createState({ a: 1, b: 2 });
            const sumSignal = toSignal(() => state.a + state.b);

            expect(sumSignal.get()).toBe(3);

            state.a = 5;
            expect(sumSignal.get()).toBe(7);

            state.b = 10;
            expect(sumSignal.get()).toBe(15);
        });
    });
});
