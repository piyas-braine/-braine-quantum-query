import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '../src/addon/query/useQuery';
import { useMutation } from '../src/addon/query/useMutation';
import { QueryClientProvider } from '../src/addon/query/context';
import { QueryCache } from '../src/addon/query/queryCache';
import React from 'react';

const createQueryClient = () => new QueryCache();

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe('Tag-based Invalidation', () => {
    it('should invalidate queries with matching tags', async () => {
        let queryCount = 0;
        const queryFn = vi.fn(async () => {
            queryCount++;
            return { id: 1, name: 'Test' };
        });

        const { result } = renderHook(() => {
            const query = useQuery({
                queryKey: ['user', 1],
                queryFn,
                tags: ['users'],
                staleTime: Infinity // Ensure it doesn't refetch automatically
            });

            const mutation = useMutation({
                mutationFn: async () => { return { success: true }; },
                invalidatesTags: ['users']
            });

            return { query, mutation };
        }, { wrapper });

        await waitFor(() => expect(result.current.query.data).toBeDefined());
        expect(queryCount).toBe(1);

        // Perform mutation
        await result.current.mutation.mutate({});

        await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

        await waitFor(() => expect(queryCount).toBe(2));
    });

    it('should NOT invalidate queries with non-matching tags', async () => {
        let queryCount = 0;
        const queryFn = vi.fn(async () => {
            queryCount++;
            return 'data';
        });

        const { result } = renderHook(() => {
            const query = useQuery({
                queryKey: ['posts'],
                queryFn,
                tags: ['posts'],
                staleTime: Infinity
            });

            const mutation = useMutation({
                mutationFn: async () => true,
                invalidatesTags: ['comments'] // Different tag
            });

            return { query, mutation };
        }, { wrapper });

        await waitFor(() => expect(result.current.query.data).toBeDefined());
        expect(queryCount).toBe(1);

        await result.current.mutation.mutate({});
        await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

        // Should NOT refetch
        expect(queryCount).toBe(1);
    });
});
