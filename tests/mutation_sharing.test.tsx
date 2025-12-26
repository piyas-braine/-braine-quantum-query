
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider, useQueryClient } from '../src/query/context';
import { QueryClient } from '../src/query/queryClient';
import { useMutation } from '../src/query/useMutation';

const createWrapper = () => {
    const client = new QueryClient();
    return {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            React.createElement(QueryClientProvider, { client, children })
        ),
        client
    };
};

describe('Shared Mutation State', () => {
    it('should NOT share state between hooks with the same mutationKey (Parallel Mutations)', async () => {
        const { wrapper, client } = createWrapper();
        const mutationKey = ['shared-mutation'];
        const mutationFn = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'success';
        });

        const { result: hook1 } = renderHook(() => useMutation({
            mutationKey,
            mutationFn
        }), { wrapper });

        const { result: hook2 } = renderHook(() => useMutation({
            mutationKey,
            mutationFn
        }), { wrapper });

        // Trigger mutation on hook1
        await act(async () => {
            hook1.current.mutate(undefined);
        });

        // Hook2 should REMAIN idle (Independent tracking)
        expect(hook2.current.status).toBe('idle');

        // But global cache should know
        expect(client.mutationCache.isMutating({ mutationKey })).toBe(1);

        // Wait for completion
        await waitFor(() => expect(hook1.current.status).toBe('success'));

        // Hook2 should still be idle
        expect(hook2.current.status).toBe('idle');
    });

    it('should track global isMutating count', async () => {
        const { wrapper, client } = createWrapper();
        const mutationFn = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return 'success';
        });

        const { result } = renderHook(() => useMutation({
            mutationKey: ['track-me'],
            mutationFn
        }), { wrapper });

        expect(client.mutationCache.isMutating()).toBe(0);

        await act(async () => {
            result.current.mutate(undefined);
        });

        // Should be 1 while pending
        expect(client.mutationCache.isMutating()).toBe(1);
        expect(client.mutationCache.isMutating({ mutationKey: ['track-me'] })).toBe(1);
        expect(client.mutationCache.isMutating({ mutationKey: ['other'] })).toBe(0);

        await waitFor(() => expect(result.current.status).toBe('success'));

        // Should be 0 after success
        expect(client.mutationCache.isMutating()).toBe(0);
    });
});
