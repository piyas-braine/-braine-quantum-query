import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/addon/query/useQuery';
import { QueryClientProvider, QueryClient } from '../src/addon/query/context';
import { QueryCache } from '../src/addon/query/queryCache';
import React from 'react';

describe('QueryClientProvider Isolation', () => {
    it('should isolate cache between providers', async () => {
        // Create two separate clients
        const clientA = new QueryCache();
        const clientB = new QueryCache();

        // Wrapper for Client A
        const wrapperA = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={clientA}>{children}</QueryClientProvider>
        );

        // Wrapper for Client B
        const wrapperB = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={clientB}>{children}</QueryClientProvider>
        );

        // Hook A uses Client A
        const { result: resultA } = renderHook(
            () => useQuery({
                queryKey: ['key'],
                queryFn: async () => 'dataA',
                staleTime: Infinity
            }),
            { wrapper: wrapperA }
        );

        // Hook B uses Client B
        const { result: resultB } = renderHook(
            () => useQuery({
                queryKey: ['key'], // Same key!
                queryFn: async () => 'dataB', // Different data!
                staleTime: Infinity
            }),
            { wrapper: wrapperB }
        );

        // Wait for both to load
        await waitFor(() => expect(resultA.current.data).toBe('dataA'));
        await waitFor(() => expect(resultB.current.data).toBe('dataB'));

        // Verify isolation: Client A should NOT have Client B's data
        expect(clientA.get(['key'])).toBe('dataA');
        expect(clientB.get(['key'])).toBe('dataB');

        // Prove cache A does not have 'dataB'
        expect(clientA.get(['key'])).not.toBe('dataB');
    });
});
