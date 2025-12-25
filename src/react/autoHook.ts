import { useSyncExternalStore, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { setActiveListener, getActiveListener } from '../core/proxy';

// Use strict React checks
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useStore<T extends object>(store: T): T {
    // We use a version counter to signal updates to React
    const versionRef = useRef(0);
    const notifyRef = useRef<(() => void) | undefined>(undefined);

    // Stable listener that React can track, which delegates to the external store notifier
    const listener = useCallback(() => {
        versionRef.current++;
        if (notifyRef.current) {
            notifyRef.current();
        }
    }, []);

    const subscribe = useCallback((onStoreChange: () => void) => {
        notifyRef.current = onStoreChange;
        return () => {
            notifyRef.current = undefined;
        };
    }, []);

    const getSnapshot = useCallback(() => versionRef.current, []);

    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    // Wrapped Proxy: Capture dependencies during render
    // logic: access property -> trigger get -> set activeListener -> proxy.ts adds listener
    const proxy = new Proxy(store, {
        get(target, prop, receiver) {
            const prev = getActiveListener();
            setActiveListener(listener);
            try {
                return Reflect.get(target, prop, receiver);
            } finally {
                setActiveListener(prev);
            }
        }
    });

    return proxy;
}
