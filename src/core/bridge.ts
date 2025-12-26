import { type Signal, createSignal } from '../addon/signals';
import { createState, setActiveListener } from './proxy';

/**
 * Bridge: Signal -> Proxy (Readonly)
 * 
 * Creates a reactive proxy object that mirrors a signal's value.
 * Useful for using Query results inside a Store.
 */
// Conditional type for the proxy result
export type ProxyResult<T> = T extends object ? T : { value: T };

export function fromSignal<T>(signal: Signal<T>): ProxyResult<T> {
    // Initial State
    const initial = signal.get();

    // We prepare the target object.
    // If initial is null/undefined or primitive, we wrap it.
    const isObject = typeof initial === 'object' && initial !== null;
    const target = (isObject ? initial : { value: initial }) as ProxyResult<T>;

    const proxy = createState(target);

    // Subscribe signal to proxy updates
    signal.subscribe((newValue) => {
        if (typeof newValue === 'object' && newValue !== null) {
            // Shallow update properties
            Object.assign(proxy, newValue);
        } else {
            // Primitive boxed update
            // We know it's a boxed proxy because T is primitive
            (proxy as { value: T }).value = newValue;
        }
    });


    return proxy;
}

/**
 * Bridge: Proxy -> Signal
 * 
 * Creates a Signal that updates whenever the accessed parts of the proxy change.
 * Uses the Proxy's `activeListener` tracking mechanism.
 */
export function toSignal<T>(selector: () => T): Signal<T> {
    const s = createSignal<T>(undefined as unknown as T);
    let isComputing = false;

    // The listener that will be attached to Proxies
    const onDependencyChange = () => {
        if (isComputing) return; // Avoid cycles
        run();
    };

    const run = () => {
        isComputing = true;
        // Set this function as the active listener
        setActiveListener(onDependencyChange);
        try {
            const value = selector();
            s.set(value);
        } finally {
            setActiveListener(null);
            isComputing = false;
        }
    };

    // Initial run to capture dependencies and set value
    run();

    // Return readonly version to prevent manual set
    return {
        get: s.get,
        set: () => { throw new Error('Cannot set a read-only bridge signal'); },
        subscribe: s.subscribe
    };
}
