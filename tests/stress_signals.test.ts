import { describe, it, expect } from 'vitest';
import { createSignal, computed } from '../src/signals';

describe('Signal Stress Tests (200 tests)', () => {
    // 100 signal update tests
    for (let i = 1; i <= 100; i++) {
        it(`should update signal ${i}`, () => {
            const signal = createSignal(0);

            for (let j = 0; j < 10; j++) {
                signal.update(n => n + 1);
            }

            expect(signal.get()).toBe(10);
        });
    }

    // 100 computed tests
    for (let i = 1; i <= 100; i++) {
        it(`should compute value ${i}`, () => {
            const base = createSignal(i);
            const doubled = computed(() => base.get() * 2);

            expect(doubled.get()).toBe(i * 2);

            base.set(i * 2);
            expect(doubled.get()).toBe(i * 4);
        });
    }
});
