export const LISTENERS = new WeakMap<object, Set<() => void>>();
export const PROXIES = new WeakMap<object, object>();
export const PROXY_TO_TARGET = new WeakMap<object, object>(); // Reverse lookup

let activeListener: (() => void) | null = null;

export function setActiveListener(listener: (() => void) | null) {
    activeListener = listener;
}

export function getActiveListener() {
    return activeListener;
}

export const GLOBAL_LISTENERS = new WeakMap<object, Set<(target: any, prop: any, value: any) => void>>();

export function subscribe(store: object, callback: (target: any, prop: any, value: any) => void) {
    // RESOLVE TARGET: Use the WeakMap to find original target if 'store' is a proxy
    const target = PROXY_TO_TARGET.get(store) || store;

    let listeners = GLOBAL_LISTENERS.get(target);
    if (!listeners) {
        listeners = new Set();
        GLOBAL_LISTENERS.set(target, listeners);
    }
    listeners.add(callback);
    return () => listeners?.delete(callback);
}

import { isPromise, handlePromise, unwrapPromise } from './asyncUtils';

const handler: ProxyHandler<object> = {
    get(target, prop, receiver) {
        if (activeListener) {
            let listeners = LISTENERS.get(target);
            if (!listeners) {
                listeners = new Set();
                LISTENERS.set(target, listeners);
            }
            listeners.add(activeListener);
        }

        const value = Reflect.get(target, prop, receiver);

        // Auto-unwrap promises (Supense support)
        if (isPromise(value)) {
            return unwrapPromise(value);
        }

        // Auto-wrap nested objects
        if (typeof value === 'object' && value !== null) {
            return createState(value);
        }

        return value;
    },

    set(target, prop, value, receiver) {
        const oldValue = Reflect.get(target, prop, receiver);
        if (Object.is(oldValue, value)) return true;

        // If setting a promise, start tracking it immediately
        if (isPromise(value)) {
            const trigger = () => {
                const listeners = LISTENERS.get(target);
                if (listeners) listeners.forEach(l => l());
            };
            handlePromise(value, trigger);
        }

        const result = Reflect.set(target, prop, value, receiver);

        // Notify property listeners
        const listeners = LISTENERS.get(target);
        if (listeners) {
            listeners.forEach(l => l());
        }

        // Notify global listeners (DevTools)
        const globals = GLOBAL_LISTENERS.get(target);
        if (globals) {
            globals.forEach(cb => cb(target, prop, value));
        }

        return result;
    },

    deleteProperty(target, prop) {
        const result = Reflect.deleteProperty(target, prop);
        const listeners = LISTENERS.get(target);
        if (listeners) {
            listeners.forEach(l => l());
        }
        return result;
    }
};

export function createState<T extends object>(initialState: T): T {
    if (PROXIES.has(initialState)) {
        return PROXIES.get(initialState) as T;
    }

    const proxy = new Proxy(initialState, handler);
    PROXIES.set(initialState, proxy);
    PROXY_TO_TARGET.set(proxy, initialState); // Track reverse mapping
    return proxy as T;
}
