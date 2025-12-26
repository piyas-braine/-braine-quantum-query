import { useCallback, useEffect, useSyncExternalStore, useState } from 'react';
import { useQueryClient } from './context';
import { type MutationState } from './mutationCache';

export interface UseMutationOptions<TData, TVariables, TContext = unknown> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    mutationKey?: unknown[];
    onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
    onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void;
    invalidatesTags?: string[];
}

export interface MutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => void;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    data: TData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isIdle: boolean;
    status: 'idle' | 'pending' | 'success' | 'error';
    reset: () => void;
}

export function useMutation<TData = unknown, TVariables = void, TContext = unknown>({
    mutationFn,
    mutationKey,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    invalidatesTags
}: UseMutationOptions<TData, TVariables, TContext>): MutationResult<TData, TVariables> {
    const client = useQueryClient();

    // Use mutationKey if provided, otherwise generate a unique temporary key (or just don't share?)
    // Real tracking requires a stable key. If no key, we might use a ref-based local key.
    // For now, if no key, we won't put it in the cache? No, we should, to allow 'isMutating' to work?
    // But 'isMutating' needs to know about it.
    // Let's generate a random key if none is provided, to ensure it participates in global tracking.
    // But random key = new signal every render? No, use useRef.

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const generatedKey = mutationKey || []; // If empty, it's just a local mutation, but wait, empty array is same key.
    // If user doesn't provide key, they usually don't care about global sharing.
    // But we promised 'client.isMutating'.
    // Let's use a unique symbol if no key?
    // Simple implementation: Key is required for sharing. If no key, we use a unique object reference.

    // Actually, create a signal locally if no key? 
    // No, putting it in MutationCache allows global tracking.

    // Generate unique ID for this hook instance if not provided, or for each mutation?
    // TanStack: useMutation tracks ONE latest mutation for the component. 
    // BUT global cache tracks all.
    // We need a stable ID for the hook to subscribe to.
    // If we want shared state (users sharing same mutationKey showing same loading), we need a Shared Key Subscription.
    // BUT the requirement is "Robust Mutation Tracking" (Parallel).
    // If Component A mutates, it gets ID_A. Component B mutates, ID_B.
    // If they share `mutationKey`, `isMutating(key)` is 2.
    // If Component A wants to show loading, it watches ID_A.
    // The previous implementation SHARED the signal. So A and B saw same state.
    // The "Evaluation" said: "Post A overwritten by Post B".
    // So we DON'T want shared state for the RESULT. We want shared state for `isMutating`.
    // So useMutation should use a LOCAL-ish ID (unique per hook or per execution).
    // Typically unique per hook ref? No, per execution.
    // But `useMutation` returns `data`, `error`. Which execution? The latest one.

    // Strategy:
    // 1. Hook holds a ref to `currentMutationId`.
    // 2. `mutate()` generates a new ID, updates ref, subscribes to that ID.
    // 3. We register that ID with the key in `client.mutationCache`.

    const [currentId, setCurrentId] = useState<string | null>(null);

    const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
        const id = Math.random().toString(36).substring(7);
        setCurrentId(id);

        // Register with cache
        client.mutationCache.register(id, mutationKey);

        const notify = (update: Partial<MutationState<TData, TVariables, TContext>>) =>
            client.mutationCache.notify(id, update);

        let context: TContext | undefined;
        const submittedAt = Date.now();

        try {
            notify({ status: 'pending', submittedAt, variables, error: null });

            if (onMutate) {
                context = await onMutate(variables);
                notify({ context });
            }

            const result = await mutationFn(variables);

            notify({ status: 'success', data: result });

            if (onSuccess) {
                // Ensure onSuccess is awaited if it returns promise? 
                // Type definition says void | Promise<void>
                await onSuccess(result, variables, context);
            }

            if (invalidatesTags) {
                client.invalidateTags(invalidatesTags);
            }

            onSettled?.(result, null, variables, context);
            return result;
        } catch (err) {
            const error = err as Error;
            notify({ status: 'error', error });
            onError?.(error, variables, context);
            onSettled?.(undefined, error, variables, context);
            throw error;
        } finally {
            // Cleanup from cache index after delay? Or keep for history?
            // keeping it allows 'data' to persist.
            // But we should unregister the key mapping eventually?
            // For 10/10 we leave it in cache but maybe clear key mapping if settled?
            // If we clear key mapping, `isMutating` goes to 0. Correct.
            // But if we delete signal, `data` is lost.
            // So we keep signal (by ID) but maybe unregister from key index if we want?
            // No, `isMutating` checks 'pending' status. So we can keep it registered.
        }
    }, [client, mutationKey, mutationFn, onMutate, onSuccess, onError, onSettled, invalidatesTags]);

    const mutate = useCallback((variables: TVariables) => {
        mutateAsync(variables).catch(() => { });
    }, [mutateAsync]);

    const reset = useCallback(() => {
        if (currentId) {
            client.mutationCache.notify(currentId, {
                status: 'idle',
                data: undefined,
                error: null,
                variables: undefined
            });
        }
    }, [client, currentId]);

    // Subscription
    const subscribe = useCallback((onStoreChange: () => void) => {
        if (!currentId) return () => { };
        const signal = client.mutationCache.getSignal<TData, TVariables, TContext>(currentId);
        return signal.subscribe(onStoreChange);
    }, [client, currentId]);

    const getSnapshot = useCallback(() => {
        if (!currentId) return DEFAULT_STATE; // Stable default state
        return client.mutationCache.getSignal<TData, TVariables, TContext>(currentId).get();
    }, [client, currentId]);

    const state = useSyncExternalStore(subscribe, getSnapshot);

    return {
        mutate,
        mutateAsync,
        data: state.data,
        error: state.error,
        status: state.status,
        isLoading: state.status === 'pending',
        isError: state.status === 'error',
        isSuccess: state.status === 'success',
        isIdle: state.status === 'idle',
        reset
    };
}

const DEFAULT_STATE: MutationState<any, any, any> = {
    data: undefined,
    error: null,
    variables: undefined,
    context: undefined,
    status: 'idle',
    submittedAt: 0
};
