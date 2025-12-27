import { type MutationCache, type MutationState } from './mutationCache';
import { type UseMutationOptions } from './useMutation';
import { type Signal, createSignal, untracked } from '../signals';
import { type QueryClient } from './queryClient'; // Type import

// Polyfill for randomUUID if needed (or just use a better random generator)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'mutation-' + Date.now() + '-' + Math.random().toString(36).slice(2);
};

export class MutationObserver<TData, TVariables, TContext> {
    private client: QueryClient;
    private options: UseMutationOptions<TData, TVariables, TContext>;
    private currentMutationId: string | null = null;

    // We maintain our own signal for this observer's view of the mutation
    // This ensures we don't miss updates if we switch IDs.
    public signal: Signal<MutationState<TData, TVariables, TContext>>;

    constructor(client: QueryClient, options: UseMutationOptions<TData, TVariables, TContext>) {
        this.client = client;
        this.options = options;

        // Initialize with default idle state
        this.signal = createSignal<MutationState<TData, TVariables, TContext>>({
            status: 'idle',
            data: undefined,
            error: null,
            variables: undefined,
            context: undefined,
            submittedAt: 0
        });
    }

    setOptions(options: UseMutationOptions<TData, TVariables, TContext>) {
        this.options = options;
    }

    mutate = (variables: TVariables): Promise<TData> => {
        const id = generateId();
        this.currentMutationId = id;

        // Register with global cache
        this.client.mutationCache.register(id, this.options.mutationKey);

        const pendingState: Partial<MutationState<TData, TVariables, TContext>> = {
            status: 'pending',
            variables,
            submittedAt: Date.now(),
            data: undefined,
            error: null,
            context: undefined
        };

        // 1. Update LOCAL Signal (Immediately visible to component)
        this.signal.set({
            ...this.signal.get(),
            ...pendingState
        } as MutationState<TData, TVariables, TContext>);

        // 2. Notify GLOBAL Cache (Immediately visible to isMutating listeners)
        this.client.mutationCache.notify(id, pendingState);

        // 3. Sync Subscription
        // Ensure future updates from cache filter down to us
        const unsubscribe = this.client.mutationCache.getSignal<TData, TVariables, TContext>(id).subscribe((state) => {
            // Use untracked to prevent this update from being tracked as a dependency
            // This breaks the reactive cycle: subscribe -> set -> subscribe -> set...
            untracked(() => {
                const current = this.signal.get();
                if (current.status !== state.status || current.data !== state.data || current.error !== state.error) {
                    this.signal.set(state);
                }
            });
        });

        // Execute Refactored Logic
        return this.executeMutation(id, variables).finally(() => {
            // unsubscribe(); // Keep subscription? 
            // If we unsubscribe, we might miss late updates? 
            // But for now, let's keep it simple.
        });
    }

    private executeMutation = async (id: string, variables: TVariables): Promise<TData> => {
        const { mutationFn, onMutate, onSuccess, onError, onSettled, invalidatesTags, optimistic, mutationKey } = this.options;
        let context: TContext | undefined;
        let optimisticSnapshot: unknown | undefined;

        const notify = (update: Partial<MutationState<TData, TVariables, TContext>>) => {
            this.client.mutationCache.notify(id, update);
        };

        try {
            // Optimistic Update
            if (optimistic) {
                const { queryKey, update } = optimistic;
                const signal = this.client.getSignal(queryKey);
                // Fix: Typings for get() result
                const currentData = signal.get()?.data;
                optimisticSnapshot = currentData;

                const optimisticData = update(variables, currentData);
                this.client.set(queryKey, optimisticData);
            }

            if (onMutate) {
                context = await onMutate(variables);
                notify({ context });
            }

            const result = await mutationFn(variables);

            notify({ status: 'success', data: result });

            if (onSuccess) await onSuccess(result, variables, context);

            if (this.client.invalidateTags && invalidatesTags) {
                this.client.invalidateTags(invalidatesTags);
            }

            if (optimistic) {
                this.client.invalidate(optimistic.queryKey);
            }

            if (onSettled) onSettled(result, null, variables, context);

            return result;
        } catch (error) {
            // Rollback
            if (optimistic && optimisticSnapshot !== undefined) {
                this.client.set(optimistic.queryKey, optimisticSnapshot);
            }

            notify({ status: 'error', error: error as Error });
            if (onError) onError(error as Error, variables, context);
            if (onSettled) onSettled(undefined, error as Error, variables, context);
            throw error;
        }
    }

    reset = () => {
        this.signal.set({
            status: 'idle',
            data: undefined,
            error: null,
            variables: undefined,
            context: undefined,
            submittedAt: 0
        });
        this.currentMutationId = null;
    }
}
