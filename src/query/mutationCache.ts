import { createSignal, type Signal } from '../signals';
import { stableHash } from './utils';

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState<TData = unknown, TVariables = unknown, TContext = unknown> {
    data: TData | undefined;
    error: Error | null;
    variables: TVariables | undefined;
    context: TContext | undefined;
    status: MutationStatus;
    submittedAt: number;
}

export class MutationCache {
    // Map<ID, Signal> - Stores state for every unique mutation execution
    private mutations = new Map<string, Signal<MutationState<unknown, unknown, unknown>>>();

    // Map<KeyHash, Set<ID>> - Index to find mutations by key
    private mutationKeys = new Map<string, Set<string>>();

    /**
     * Get or Create a Signal for a specific mutation instance (ID)
     */
    getSignal = <TData, TVariables, TContext>(id: string): Signal<MutationState<TData, TVariables, TContext>> => {
        let signal = this.mutations.get(id);

        if (!signal) {
            const initialState: MutationState<TData, TVariables, TContext> = {
                data: undefined,
                error: null,
                variables: undefined,
                context: undefined,
                status: 'idle',
                submittedAt: 0
            };
            // Create signal with auto-cleanup? 
            // We should probably remove it from cache when it's settled and no longer observed?
            // For now, simple manual management or LRU later. (10/10 requires robust GC but we focus on ID tracking first)
            signal = createSignal(initialState) as unknown as Signal<MutationState<unknown, unknown, unknown>>;
            this.mutations.set(id, signal);
        }

        return signal as Signal<MutationState<TData, TVariables, TContext>>;
    }

    /**
     * Register a mutation ID with a Key (for tracking shared keys)
     */
    register = (id: string, key?: unknown[]) => {
        if (!key) return;
        const hash = stableHash(key);
        if (!this.mutationKeys.has(hash)) {
            this.mutationKeys.set(hash, new Set());
        }
        this.mutationKeys.get(hash)!.add(id);
    }

    /**
     * Unregister cleanup
     */
    unregister = (id: string, key?: unknown[]) => {
        if (!key) return;
        const hash = stableHash(key);
        const set = this.mutationKeys.get(hash);
        if (set) {
            set.delete(id);
            if (set.size === 0) {
                this.mutationKeys.delete(hash);
            }
        }
        this.mutations.delete(id);
    }

    notify = <TData, TVariables, TContext>(
        id: string,
        state: Partial<MutationState<TData, TVariables, TContext>>
    ) => {
        const signal = this.getSignal<TData, TVariables, TContext>(id);
        const current = signal.get();
        signal.set({ ...current, ...state });
    }

    /**
     * Get number of mutations currently pending
     */
    isMutating = (filters?: { mutationKey?: unknown[] }): number => {
        let count = 0;

        if (filters?.mutationKey) {
            // Check only specific key
            const hash = stableHash(filters.mutationKey);
            const ids = this.mutationKeys.get(hash);
            if (!ids) return 0;

            for (const id of ids) {
                if (this.mutations.get(id)?.get().status === 'pending') {
                    count++;
                }
            }
        } else {
            // Check all
            for (const signal of this.mutations.values()) {
                if (signal.get().status === 'pending') count++;
            }
        }

        return count;
    }
}
