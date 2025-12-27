import { useCallback, useEffect, useSyncExternalStore, useState } from 'react';
import { useQueryClient } from './context';
import { type MutationState } from './mutationCache';
import { MutationObserver } from './mutationObserver';

export interface UseMutationOptions<TData, TVariables, TContext = unknown> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    mutationKey?: unknown[];
    onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
    onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void;
    invalidatesTags?: string[];
    optimistic?: {
        queryKey: unknown[];
        update: (variables: TVariables, oldData: unknown) => unknown;
    };
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

export function useMutation<TData = unknown, TVariables = void, TContext = unknown>(
    options: UseMutationOptions<TData, TVariables, TContext>
): MutationResult<TData, TVariables> {
    const client = useQueryClient();

    // Stable Observer Instance
    const [observer] = useState(() => new MutationObserver<TData, TVariables, TContext>(client, options));

    // Sync Options
    useEffect(() => {
        observer.setOptions(options);
    }, [observer, options]);

    // Derived State Subscription
    // O(1) update via Signal
    const state = useSyncExternalStore(
        useCallback((cb) => observer.signal.subscribe(cb), [observer]),
        () => observer.signal.get(),
        () => observer.signal.get()
    );

    const mutateAsync = useCallback((variables: TVariables) => {
        return observer.mutate(variables);
    }, [observer]);

    const mutate = useCallback((variables: TVariables) => {
        observer.mutate(variables).catch(() => { });
    }, [observer]);

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
        reset: observer.reset
    };
}

