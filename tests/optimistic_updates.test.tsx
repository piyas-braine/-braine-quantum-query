import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMutation } from '../src/addon/query/useMutation';
import { useQuery } from '../src/addon/query/useQuery';
import { QueryClientProvider, createQueryClient } from '../src/addon/query/context';
import { QueryCache } from '../src/addon/query/queryCache';

const createWrapper = (client: QueryCache) => ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('Optimistic Updates V2', () => {
    let client: QueryCache;

    beforeEach(() => {
        client = new QueryCache();
    });

    it('should apply optimistic update and persist on success', async () => {
        // 1. Setup Initial State
        const queryKey = ['todos'];
        client.set(queryKey, ['todo1']);

        const wrapper = createWrapper(client);

        // 2. Define Mutation Hook
        const { result } = renderHook(() => useMutation({
            mutationFn: async (newTodo: string) => {
                await new Promise(r => setTimeout(r, 50)); // Delay
                return newTodo;
            },
            optimistic: {
                queryKey,
                update: (newTodo, oldData: string[]) => [...oldData, newTodo]
            }
        }), { wrapper });

        // 3. Trigger Mutation
        await act(async () => {
            result.current.mutate('todo2');
        });

        // 4. Verify Optimistic State (Immediate)
        // Since we are inside 'act' with await, the mutation finishes. 
        // We need to check state *during* mutation if possible, but testing library awaits acts.
        // However, we can check that it didn't rollback.

        const data = client.getSignal(queryKey).get()?.data;
        expect(data).toEqual(['todo1', 'todo2']);
    });

    it('should rollback on error', async () => {
        // 1. Setup Initial State
        const queryKey = ['todos_error'];
        client.set(queryKey, ['todo1']);

        const wrapper = createWrapper(client);

        // 2. Define Mutation Hook
        const { result } = renderHook(() => useMutation({
            mutationFn: async () => {
                throw new Error('Failed');
            },
            optimistic: {
                queryKey,
                update: (newTodo, oldData: string[]) => [...oldData, newTodo]
            }
        }), { wrapper });

        // 3. Trigger Mutation
        await act(async () => {
            try {
                await result.current.mutateAsync('todo2');
            } catch (e) {
                // Ignore
            }
        });

        // 4. Verify Rollback
        const data = client.getSignal(queryKey).get()?.data;
        expect(data).toEqual(['todo1']); // Should be back to original
    });
});
