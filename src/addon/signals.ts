/**
 * Micro-Signals with Batching (Zero Dependency Reactivity)
 * 
 * A minimal implementation of the Signals pattern with micro-batching for O(1) state updates.
 * Uses queueMicrotask to coalesce multiple updates into a single notification cycle.
 * Includes Computed Signals and Lifecycle Hooks.
 */

export interface Signal<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (fn: (value: T) => void) => () => void;
}

// Global batching state
const pendingSignals = new Set<SignalImpl<any>>();
let isFlushScheduled = false;

function flushPendingSignals() {
    const toFlush = Array.from(pendingSignals);
    pendingSignals.clear();
    isFlushScheduled = false;
    toFlush.forEach(signal => signal.flush());
}

// Global context for dependency tracking (Computed)
let activeEffect: SignalImpl<any> | null = null;

export interface SignalOptions {
    onActive?: () => void;
    onInactive?: () => void;
}

class SignalImpl<T> implements Signal<T> {
    private value: T;
    private subscribers = new Set<(value: T) => void>();
    private options?: SignalOptions;

    // For computed signals
    private compute?: () => T;
    private dependencies = new Set<SignalImpl<any>>();

    constructor(initialValue: T, options?: SignalOptions, compute?: () => T) {
        this.value = initialValue;
        this.options = options;
        this.compute = compute;

        if (compute) {
            this.update();
        }
    }

    // Re-calculate derived value
    private update = () => {
        if (!this.compute) return;

        // Track dependencies
        const prevEffect = activeEffect;
        activeEffect = this;

        // Clean up old dependencies
        this.dependencies.forEach(dep => dep.subscribers.delete(this.onDependencyUpdate));
        this.dependencies.clear();

        try {
            const newValue = this.compute();
            if (this.value !== newValue) {
                this.set(newValue); // Trigger updates
            }
        } finally {
            activeEffect = prevEffect;
        }
    }

    // Callback when a dependency changes
    private onDependencyUpdate = (val: any) => {
        this.update();
    }

    get = (): T => {
        // If we are getting this signal inside another computed/effect, register dependency
        if (activeEffect) {
            activeEffect.dependencies.add(this);
            // We subscribe our `onDependencyUpdate` to the dependency
            // But `subscribe` takes a callback.
            // We bypass the public subscribe to avoid `onActive` trigger? 
            // Or just use public subscribe?
            // If we use public subscribe, we might trigger onActive/onInactive incorrectly for GC?
            // For computed, dependencies don't necessarily count as "observers" for GC purposes 
            // if the computed itself has no observers.
            // BUT for now, let's treat them as observers to keep dependencies alive.
            this.subscribers.add(activeEffect.onDependencyUpdate);
        }
        return this.value;
    };

    set = (newValue: T): void => {
        // Computed signals usually shouldn't be set manually, but we use set internally to trigger notifications
        // Public API for computed should block set?
        // For simplicity allow internal set.

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
        // Copy to avoid modification during iteration
        new Set(this.subscribers).forEach(fn => fn(currentValue));
    }

    subscribe = (fn: (value: T) => void): (() => void) => {
        const wasEmpty = this.subscribers.size === 0;
        this.subscribers.add(fn);

        if (wasEmpty) {
            this.options?.onActive?.();
            // If we are computed, we might need to wake up our dependencies?
            // Currently we compute eagerly in constructor, so we are always up to date?
            // If we wanted lazy, we would re-connect here.
        }

        return () => {
            this.subscribers.delete(fn);
            if (this.subscribers.size === 0) {
                this.options?.onInactive?.();
                // If computed, we could disconnect dependencies here to allow GC.
                // Not implemented for this iteration.
            }
        };
    };
}

export function createSignal<T>(initialValue: T, options?: SignalOptions): Signal<T> {
    return new SignalImpl(initialValue, options);
}

export function computed<T>(fn: () => T): Signal<T> {
    // Initial value is undefined until computed
    // We pass undefined as initial, but it updates immediately in constructor
    return new SignalImpl<T>(undefined as unknown as T, undefined, fn);
}
