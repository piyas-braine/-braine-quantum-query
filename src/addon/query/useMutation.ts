/**
 * useMutation Hook
 * Handles mutations with optimistic updates and rollback
 */

import { useState, useCallback } from 'react';
import { queryCache } from './queryCache';

export interface UseMutationOptions<TData, TVariables, TContext = any> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
    onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
    onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void;
}

export interface MutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => Promise<void>;
    mutateAsync: (variables: TVariables) => Promise<TData>;
    data: TData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    reset: () => void;
}

export function useMutation<TData = unknown, TVariables = void, TContext = any>({
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled
}: UseMutationOptions<TData, TVariables, TContext>): MutationResult<TData, TVariables> {
    const [data, setData] = useState<TData | undefined>();
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
        let context: TContext | undefined;

        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            setIsSuccess(false);

            // Run onMutate (optimistic update)
            if (onMutate) {
                context = await onMutate(variables);
            }

            // Execute mutation
            const result = await mutationFn(variables);

            // Success
            setData(result);
            setIsSuccess(true);
            setIsLoading(false);

            if (onSuccess) {
                onSuccess(result, variables, context);
            }

            if (onSettled) {
                onSettled(result, null, variables, context);
            }

            return result;
        } catch (err: any) {
            // Error - rollback
            setIsError(true);
            setError(err);
            setIsLoading(false);

            if (onError) {
                onError(err, variables, context);
            }

            if (onSettled) {
                onSettled(undefined, err, variables, context);
            }

            throw err;
        }
    }, [mutationFn, onMutate, onSuccess, onError, onSettled]);

    const mutate = useCallback(async (variables: TVariables) => {
        try {
            await mutateAsync(variables);
        } catch {
            // Swallow error for fire-and-forget mutations
        }
    }, [mutateAsync]);

    const reset = useCallback(() => {
        setData(undefined);
        setError(null);
        setIsLoading(false);
        setIsError(false);
        setIsSuccess(false);
    }, []);

    return {
        mutate,
        mutateAsync,
        data,
        error,
        isLoading,
        isError,
        isSuccess,
        reset
    };
}

// Helper for optimistic updates
export const optimisticHelpers = {
    /**
     * Cancel ongoing queries for a key
     */
    async cancelQueries(queryKey: any[]) {
        // Future: implement query cancellation tracking
    },

    /**
     * Get current query data
     */
    getQueryData<T>(queryKey: any[]): T | undefined {
        return queryCache.get<T>(queryKey);
    },

    /**
     * Set query data (for optimistic updates)
     */
    setQueryData<T>(queryKey: any[], updater: T | ((old: T | undefined) => T)) {
        const current = queryCache.get<T>(queryKey);
        const newData = typeof updater === 'function'
            ? (updater as (old: T | undefined) => T)(current)
            : updater;
        queryCache.set(queryKey, newData);
        return current; // Return old data for rollback
    },

    /**
     * Invalidate queries (trigger refetch)
     */
    invalidateQueries(queryKey: any[]) {
        queryCache.invalidate(queryKey);
    }
};
