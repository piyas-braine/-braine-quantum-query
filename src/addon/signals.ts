/**
 * Micro-Signals (Powered by @preact/signals-core)
 * 
 * Industry-standard ultra-fast fine-grained reactivity.
 * API adapted to match original interface for backward compatibility.
 */

import { signal, computed as preactComputed, effect, batch } from '@preact/signals-core';

export interface Signal<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (fn: (value: T) => void) => () => void;
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
    let unsubscribeActive: (() => void) | undefined;
    let subscriberCount = 0;

    // We wrap the Preact signal to support our specific subscribe/lifecycle API
    return {
        get: () => s.value,

        set: (newValue: T) => {
            s.value = newValue;
        },

        subscribe: (fn: (value: T) => void) => {
            // Lifecycle: First subscriber
            if (subscriberCount === 0) {
                options?.onActive?.();
            }
            subscriberCount++;

            // Use 'effect' to subscribe to changes.
            // Preact effects run immediately.
            const dispose = effect(() => {
                fn(s.value);
            });

            return () => {
                dispose();
                subscriberCount--;
                // Lifecycle: Last subscriber
                if (subscriberCount === 0) {
                    options?.onInactive?.();
                }
            };
        }
    };
}

/**
 * Computed signal derived from other signals.
 */
export function computed<T>(fn: () => T): Signal<T> {
    const c = preactComputed(fn);

    return {
        get: () => c.value,
        set: () => {
            throw new Error("Cannot set a computed signal directly.");
        },
        subscribe: (fn: (value: T) => void) => {
            return effect(() => {
                fn(c.value);
            });
        }
    };
}

/**
 * Batch updates (re-export Preact batch)
 */
export { batch };
