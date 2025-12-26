import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { createSignal } from '../src/signals';

describe('Signal Batching', () => {
    it('should batch 100 updates into 1 render', async () => {
        const signal = createSignal(0);
        let renderCount = 0;

        const { result } = renderHook(() => {
            renderCount++;
            return useSyncExternalStore(signal.subscribe, signal.get);
        });

        expect(result.current).toBe(0);
        expect(renderCount).toBe(1);

        // Update signal 100 times synchronously
        for (let i = 1; i <= 100; i++) {
            signal.set(i);
        }

        // Wait for microtask to flush
        await new Promise(resolve => queueMicrotask(resolve as VoidFunction));
        await new Promise(resolve => setTimeout(resolve, 0));

        // Should only trigger ONE additional render
        expect(renderCount).toBe(2);
        expect(result.current).toBe(100);
    });

    it('should batch multiple signal updates', async () => {
        const signal1 = createSignal('a');
        const signal2 = createSignal('b');

        let signal1RenderCount = 0;
        let signal2RenderCount = 0;

        const { result: result1 } = renderHook(() => {
            signal1RenderCount++;
            return useSyncExternalStore(signal1.subscribe, signal1.get);
        });

        const { result: result2 } = renderHook(() => {
            signal2RenderCount++;
            return useSyncExternalStore(signal2.subscribe, signal2.get);
        });

        expect(signal1RenderCount).toBe(1);
        expect(signal2RenderCount).toBe(1);

        // Update both signals multiple times
        signal1.set('x');
        signal1.set('y');
        signal1.set('z');
        signal2.set('1');
        signal2.set('2');
        signal2.set('3');

        // Wait for batched updates
        await new Promise(resolve => queueMicrotask(resolve as VoidFunction));
        await new Promise(resolve => setTimeout(resolve, 0));

        // Each hook should only re-render once
        expect(signal1RenderCount).toBe(2);
        expect(signal2RenderCount).toBe(2);
        expect(result1.current).toBe('z');
        expect(result2.current).toBe('3');
    });
});
