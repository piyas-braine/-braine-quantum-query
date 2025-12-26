/**
 * Micro-Signals (Quantum Reactive Engine)
 * 
 * Industry-standard ultra-fast fine-grained reactivity.
 * API encapsulated to prevent abstraction leaks and ensure safety.
 */

import {
    signal,
    computed as preactComputed,
    effect as preactEffect,
    batch as preactBatch,
    untracked as preactUntracked
} from '@preact/signals-core';

export interface Signal<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (fn: (value: T) => void) => () => void;
    isWatched: () => boolean;
}

export interface SignalOptions {
    onActive?: () => void;
    onInactive?: () => void;
}

/**
 * Create a reactive signal.
 */
export function createSignal<T>(initialValue: T, options?: SignalOptions): Signal<T> {
    const s = signal<T>(initialValue);
    let subscriberCount = 0;

    return {
        get: () => s.value,

        set: (newValue: T) => {
            s.value = newValue;
        },

        subscribe: (fn: (value: T) => void) => {
            if (subscriberCount === 0) {
                options?.onActive?.();
            }
            subscriberCount++;

            const dispose = preactEffect(() => {
                fn(s.value);
            });

            return () => {
                dispose();
                subscriberCount--;
                if (subscriberCount === 0) {
                    options?.onInactive?.();
                }
            };
        },

        isWatched: () => subscriberCount > 0
    };
}

/**
 * Computed signal derived from other signals.
 */
export function computed<T>(fn: () => T): Signal<T> {
    const c = preactComputed(fn);
    let subscriberCount = 0;

    return {
        get: () => c.value,
        set: () => {
            throw new Error("[Quantum] Cannot set a computed signal directly.");
        },
        subscribe: (fn: (value: T) => void) => {
            subscriberCount++;
            const dispose = preactEffect(() => {
                fn(c.value);
            });
            return () => {
                dispose();
                subscriberCount--;
            };
        },
        isWatched: () => subscriberCount > 0
    };
}

/**
 * Run a side effect that automatically tracks dependencies.
 * Safer wrapper around Preact effect.
 */
export function effect(fn: () => void | (() => void)): () => void {
    return preactEffect(fn);
}

/**
 * Batch multiple updates into a single re-render cycle.
 */
export function batch(fn: () => void): void {
    preactBatch(fn);
}

/**
 * Access a signal value without tracking it as a dependency.
 */
export function untracked<T>(fn: () => T): T {
    return preactUntracked(fn);
}
