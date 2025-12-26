import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/query/useQuery';
import { QueryClientProvider } from '../src/query/context';
import { QueryCache } from '../src/query/queryCache';

describe('Query Cancellation', () => {
    let client: QueryCache;

    beforeEach(() => {
        client = new QueryCache();
    });

    it('should pass abort signal to query function', async () => {
        const abortSpy = vi.fn();
        const queryFn = vi.fn().mockImplementation(({ signal }) => {
            signal?.addEventListener('abort', abortSpy);
            return new Promise(resolve => setTimeout(() => resolve('data'), 100));
        });

        const { unmount } = renderHook(() => useQuery({
            queryKey: ['cancellation-test'],
            queryFn
        }), {
            wrapper: ({ children }) => (
                <QueryClientProvider client={client}>{children}</QueryClientProvider>
            )
        });

        // Unmount before query finishes -> should trigger abort
        unmount();

        await waitFor(() => {
            expect(abortSpy).toHaveBeenCalled();
        });
    });

    it('should abort previous request on new fetch', async () => {
        const abortSpy = vi.fn();
        let callCount = 0;

        const queryFn = vi.fn().mockImplementation(({ signal }) => {
            signal?.addEventListener('abort', abortSpy);
            callCount++;
            return new Promise(resolve => setTimeout(() => resolve('data ' + callCount), 100));
        });

        const { result, rerender } = renderHook(({ key }) => useQuery({
            queryKey: [key],
            queryFn
        }), {
            wrapper: ({ children }) => (
                <QueryClientProvider client={client}>{children}</QueryClientProvider>
            ),
            initialProps: { key: 'test-1' }
        });

        // Change key immediately to trigger new fetch, which aborts old controller on cleanup/effect re-run?
        // Wait, change key -> component updates -> effect deps change -> old cleanup runs (abort) -> new effect runs.
        rerender({ key: 'test-2' });

        await waitFor(() => {
            expect(abortSpy).toHaveBeenCalled();
        });
    });
});
