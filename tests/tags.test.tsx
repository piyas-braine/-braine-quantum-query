import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useQuery } from '../src/query/useQuery';
import { useMutation } from '../src/query/useMutation';
import { QueryClient } from '../src/query/queryClient';
import { QueryClientProvider } from '../src/query/context';
import React from 'react';

describe('Cache Tags Invalidation', () => {
    let client: QueryClient;
    let wrapper: React.FC<{ children: React.ReactNode }>;

    beforeEach(() => {
        client = new QueryClient();
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        vi.clearAllMocks();
    });

    it('should invalidate queries with matching tags', async () => {
        const fetchFn = vi.fn().mockImplementation(async () => {
            return { data: 'data-' + Math.random() };
        });

        const { result } = renderHook(() =>
            useQuery({
                queryKey: ['user', 1],
                queryFn: fetchFn,
                tags: ['User'],
                staleTime: 60000 // Verified cached
            }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fetchFn).toHaveBeenCalledTimes(1);

        // Invalidate via Tags
        await act(async () => {
            client.invalidateTags(['User']);
        });

        // Should be stale and refetching?
        // QueryObserver reacts to 'isInvalidated' by marking stale.
        // If caching is active, it should auto-refetch if the observer is active.

        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    });

    it('should work with useMutation invalidatesTags', async () => {
        const fetchFn = vi.fn().mockResolvedValue('fresh');

        // 1. Setup Query
        const { result: queryResult } = renderHook(() =>
            useQuery({
                queryKey: ['user', 2],
                queryFn: fetchFn,
                tags: ['User_2'],
                staleTime: Infinity
            }),
            { wrapper }
        );

        await waitFor(() => expect(queryResult.current.data).toBe('fresh'));

        // 2. Setup Mutation
        const { result: mutationResult } = renderHook(() => useMutation({
            mutationFn: async () => { return 'updated' },
            invalidatesTags: ['User_2']
        }), { wrapper });

        // 3. Trigger Mutation
        await act(async () => {
            await mutationResult.current.mutateAsync();
        });

        // 4. Verify Refetch
        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    });

    it('should NOT invalidate queries without matching tags', async () => {
        const fetchFn = vi.fn().mockResolvedValue('data');

        renderHook(() =>
            useQuery({
                queryKey: ['user', 3],
                queryFn: fetchFn,
                tags: ['Safe'],
                staleTime: Infinity
            }),
            { wrapper }
        );

        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

        await act(async () => {
            client.invalidateTags(['Unrelated_Tag']);
        });

        // Wait a bit to ensure nothing happens
        await new Promise(r => setTimeout(r, 100));

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});
