import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/query/useQuery';
import { QueryCache } from '../src/query/queryCache';
import { QueryClientProvider } from '../src/query/context';
import React from 'react';

describe('useQuery Selectors', () => {
    let client: QueryCache;
    let wrapper: React.FC<{ children: React.ReactNode }>;

    beforeEach(() => {
        client = new QueryCache();
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        vi.clearAllMocks();
    });

    it('should select data', async () => {
        const { result } = renderHook(() =>
            useQuery({
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
            useQuery({
                queryKey: ['users_memo'],
                queryFn: async () => [{ id: 1, name: 'Alice' }],
                select: selectSpy
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(['Alice']);
        expect(selectSpy).toHaveBeenCalledTimes(1);

        // Rerender component
        rerender();

        // Should NOT call selector again if data hasn't changed
        expect(selectSpy).toHaveBeenCalledTimes(1);

        // Even if we access result again
        expect(result.current.data).toEqual(['Alice']);
    });
});
