import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/query/useQuery';
import { QueryClient } from '../src/query/queryClient';
import { QueryClientProvider } from '../src/query/context';
import React from 'react';

describe('useQuery Selectors', () => {
    let client: QueryClient;
    let wrapper: React.FC<{ children: React.ReactNode }>;

    beforeEach(() => {
        client = new QueryClient();
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        vi.clearAllMocks();
    });

    it('should select data', async () => {
        const { result } = renderHook(() =>
            useQuery<{ id: number; name: string }[], string[]>({
                queryKey: ['users'],
                queryFn: async () => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
                select: (data) => data.map(u => u.name)
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual(['Alice', 'Bob']);
    });

    it('should memoize selected result', async () => {
        const selectSpy = vi.fn((data: any[]) => data.map(u => u.name));

        const { result, rerender } = renderHook(() =>
            useQuery<any[], string[]>({
                queryKey: ['users_memo'],
                queryFn: async () => [{ id: 1, name: 'Alice' }],
                select: selectSpy,
                staleTime: 60000 // Keep data fresh to avoid refetches
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(['Alice']);

        // Record how many times selector was called initially (may be > 1 due to StrictMode)
        const initialCalls = selectSpy.mock.calls.length;
        expect(initialCalls).toBeGreaterThan(0);

        // Rerender component
        rerender();
        await new Promise(r => setTimeout(r, 50));

        // Should NOT call selector again if data hasn't changed
        expect(selectSpy).toHaveBeenCalledTimes(initialCalls);

        // Even if we access result again
        expect(result.current.data).toEqual(['Alice']);
        expect(selectSpy).toHaveBeenCalledTimes(initialCalls);
    });
});
