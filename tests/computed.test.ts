import { describe, it, expect, vi } from 'vitest';
import { createSignal, computed } from '../src/signals';

describe('Computed Signals', () => {
    it('should derive state from a source signal', () => {
        const count = createSignal(1);
        const double = computed(() => count.get() * 2);

        expect(double.get()).toBe(2);

        count.set(2);
        // Computed updates immediately if accessed (or scheduled if lazy, but our impl updates aggressively for simplicity)
        // Wait, our update is synchronous? 
        // In `update()`, we call `compute()`, setting `value`.
        // BUT `set` schedules flushing. `onDependencyUpdate` calls `update` synchronously?
        // Let's check impl. `onDependencyUpdate` calls `this.update()`.
        // `update` re-computes.
        // If `flushPendingSignals` is async, does that matter?
        // `count.set(2)` sets value and schedules flush.
        // It does NOT notify subscribers immediately.
        // So `onDependencyUpdate` (which is a subscriber) is NOT called immediately.
        // It is called during flush.

    });

    it('should update reactive dependencies', async () => {
        const count = createSignal(1);
        const double = computed(() => count.get() * 2);
        const spy = vi.fn();

        double.subscribe(spy);

        expect(double.get()).toBe(2);

        count.set(2);
        // Expect no immediate update due to batching

        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for microtask

        expect(double.get()).toBe(4);
        expect(spy).toHaveBeenCalledWith(4);
    });

    it('should handle multiple dependencies', async () => {
        const first = createSignal('John');
        const last = createSignal('Doe');
        const full = computed(() => `${first.get()} ${last.get()}`);

        expect(full.get()).toBe('John Doe');

        first.set('Jane');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(full.get()).toBe('Jane Doe');

        last.set('Smith');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(full.get()).toBe('Jane Smith');
    });

    it('should handle diamond dependencies', async () => {
        // A -> B, A -> C, B+C -> D
        const count = createSignal(1);
        const double = computed(() => count.get() * 2);
        const triple = computed(() => count.get() * 3);
        const sum = computed(() => double.get() + triple.get());

        expect(sum.get()).toBe(5);

        count.set(2);
        await new Promise(resolve => setTimeout(resolve, 0));

        // double -> 4, triple -> 6. sum -> 10.
        expect(sum.get()).toBe(10);
    });
});
