import { type Signal } from '../signals';
import { useEffect, useRef, useState } from 'react';

export interface SignalValueProps<T> {
    signal: Signal<T>;
    render?: (value: T) => React.ReactNode;
    children?: (value: T) => React.ReactNode;
}

/**
 * SignalValue
 * A component that renders the value of a signal directly.
 * The component subscribes to the signal and updates ONLY itself when the signal changes.
 * This prevents re-rendering the parent component.
 * 
 * Usage:
 * <SignalValue signal={count$} render={count => <span>{count}</span>} />
 * or
 * <SignalValue signal={count$}>{count => <span>{count}</span>}</SignalValue>
 */
export function SignalValue<T>({ signal, render, children }: SignalValueProps<T>) {
    // We use a state to force re-render of THIS component when signal changes
    const [value, setValue] = useState(() => signal.get());

    // We only subscribe once
    useEffect(() => {
        // Handle case where signal might have changed before effect runs?
        // Signals are synchronous usually.

        const unsubscribe = signal.subscribe((newValue) => {
            setValue(newValue);
        });

        return () => unsubscribe();
    }, [signal]);

    // Check if signal value is newer than state? 
    // Effect handles it.

    // Render
    const renderer = render || children;
    if (!renderer) return null; // Or render value directly if primitive?

    return <>{renderer(value)}</>;
}
