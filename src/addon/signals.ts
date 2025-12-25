/**
 * Micro-Signals with Batching (Zero Dependency Reactivity)
 * 
 * A minimal implementation of the Signals pattern with micro-batching for O(1) state updates.
 * Uses queueMicrotask to coalesce multiple updates into a single notification cycle.
 */

export interface Signal<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (fn: (value: T) => void) => () => void;
}

// Global batching state - track signals that need flushing
const pendingSignals = new Set<SignalImpl<any>>();
let isFlushScheduled = false;

function flushPendingSignals() {
    const toFlush = Array.from(pendingSignals);
    pendingSignals.clear();
    isFlushScheduled = false;
    toFlush.forEach(signal => signal.flush());
}

class SignalImpl<T> implements Signal<T> {
    private value: T;
    private subscribers = new Set<(value: T) => void>();

    constructor(initialValue: T) {
        this.value = initialValue;
    }

    get = (): T => this.value;

    set = (newValue: T): void => {
        if (this.value === newValue) return;
        this.value = newValue;

        // Schedule this signal for flushing
        pendingSignals.add(this);

        if (!isFlushScheduled) {
            isFlushScheduled = true;
            queueMicrotask(flushPendingSignals);
        }
    };

    flush(): void {
        const currentValue = this.value;
        this.subscribers.forEach(fn => fn(currentValue));
    }

    subscribe = (fn: (value: T) => void): (() => void) => {
        this.subscribers.add(fn);
        return () => {
            this.subscribers.delete(fn);
        };
    };
}

export function createSignal<T>(initialValue: T): Signal<T> {
    return new SignalImpl(initialValue);
}
