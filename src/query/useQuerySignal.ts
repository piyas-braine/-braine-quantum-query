import { useEffect, useState } from 'react';
import { useQueryClient } from './context';
import { QueryObserver, type QueryObserverOptions, type QueryObserverResult } from './queryObserver';
import { type Signal } from '../signals';

/**
 * useQuery$ (The Quantum Hook)
 * 
 * Returns a reactive SIGNAL of the query result.
 * Accessing .value (or .get()) inside a tracked context (like <SignalValue>) will update fine-grained.
 * Accessing it in a standard component render will NOT trigger re-renders when data changes.
 * 
 * This is the "Zero-Render" primitive.
 */
export function useQuery$<T>(options: QueryObserverOptions<T>): Signal<QueryObserverResult<T>> {
    const client = useQueryClient();

    // Stable observer
    const [observer] = useState(() => new QueryObserver<T>(client, options));

    // Sync options (React Reactivity -> Signal Reactivity)
    useEffect(() => {
        observer.setOptions(options);
    }, [observer, options.enabled, options.staleTime, options.cacheTime, options.queryKey, options.refetchInterval]);
    // ^ simplified deps, actually usually we pass 'options' and let observer diff.
    // But passing object literal 'options' every render triggers useEffect every render.
    // Which calls setOptions every render.
    // Observer.setOptions checks equality so it's cheap.

    // Lifecycle
    useEffect(() => {
        // We must subscribe to keep the observer alive and side-effects active
        const unsubscribe = observer.subscribe(() => {
            // We don't need to do anything here for React.
            // The signal updates automatically.
            // But we need a subscriber to keep the computed 'hot' if lazy?
            // preact/signals computed are lazy. If no one listens, they don't update side effects?
            // Actually, our QueryObserver has side effects (fetch) inside an 'effect'.
            // 'effect' runs automatically.
        });
        return () => {
            unsubscribe();
            observer.destroy();
        };
    }, [observer]);

    return observer.result$;
}
