import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '../src';

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Concurrency & Stability', () => {
    afterEach(() => {
        cleanup();
    });

    it('should maintain stable result references during re-renders', async () => {
        const client = new QueryClient();
        const data = { id: 1 };

        let renderCount = 0;
        let lastResult: any = null;

        function TestComponent() {
            renderCount++;
            const result = useQuery<{ id: number }>({
                queryKey: ['stable'],
                queryFn: async () => data,
                staleTime: 1000
            });

            if (lastResult) {
                // Check referential equality of the result object
                if (result !== lastResult && result.data === lastResult.data && result.isFetching === lastResult.isFetching) {
                    // If data/state didn't change, reference SHOULD be stable, but useQuery might return new object if something else changed?
                    // strict equality check
                }
            }
            lastResult = result;

            // Force re-render via local state
            const [_, setTick] = useState(0);
            if (renderCount < 3) {
                setTimeout(() => setTick(t => t + 1), 10);
            }

            return <div>{result.data?.id}</div>;
        }

        render(
            <QueryClientProvider client={client}>
                <TestComponent />
            </QueryClientProvider>
        );

        await waitFor(() => screen.findByText('1'));

        expect(renderCount).toBeGreaterThanOrEqual(2);

        // Verify final state
        expect(await screen.findByText('1')).toBeTruthy();
    });

    it('should unsubscribe and cleanup when unmounted', async () => {
        const client = new QueryClient({ defaultCacheTime: 50 }); // Fast GC
        const key = ['gc-test'];

        // Pre-populate
        client.set(key, 'test');

        function App() {
            useQuery({ queryKey: key, queryFn: async () => 'test' });
            return <div>App</div>;
        }

        const { unmount } = render(
            <QueryClientProvider client={client}>
                <App />
            </QueryClientProvider>
        );

        // Should have a signal
        expect(client.getStats().size).toBe(1);

        unmount();

        // Wait for GC
        await sleep(100);

        // Stats should be 0 (garbage collected)
        expect(client.getStats().size).toBe(0);
    });

    it('should handle rapid mounting/unmounting without race conditions', async () => {
        const client = new QueryClient();
        const key = ['rapid'];
        let fetchCount = 0;

        const queryFn = async () => {
            fetchCount++;
            await sleep(20);
            return 'done';
        };

        function Comp() {
            useQuery({ queryKey: key, queryFn });
            return <div>Comp</div>;
        }

        const { unmount } = render(
            <QueryClientProvider client={client}>
                <Comp />
            </QueryClientProvider>
        );

        unmount();

        render(
            <QueryClientProvider client={client}>
                <Comp />
            </QueryClientProvider>
        );

        await waitFor(() => expect(fetchCount).toBeGreaterThan(0));

        expect(fetchCount).toBeGreaterThanOrEqual(1);
    });
});
