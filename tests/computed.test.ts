import { describe, it, expect, vi } from 'vitest';
import { createState, setActiveListener } from '../src/core/proxy';
import { computed } from '../src/core/computed';

describe('computed', () => {
    it('should memoize values', () => {
        // Note: Our simple computed implementation is just a lazy getter in this iteration.
        // It resets on dirty, but we haven't wired up "dirty" to listeners yet in the simple version.
        // Let's testing the simple memoization.

        let calls = 0;
        const getter = computed(() => {
            calls++;
            return 'heavy';
        });

        expect(getter.value).toBe('heavy');
        expect(getter.value).toBe('heavy');
        expect(calls).toBe(1);
    });
});
