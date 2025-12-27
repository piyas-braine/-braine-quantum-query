import React from 'react';
import { type Signal } from '../signals';
import { SignalValue } from './SignalValue';

export interface QueryMatchProps<T, TResult> {
    signal: Signal<T>;
    selector: (value: T) => TResult;
    children: (value: TResult) => React.ReactNode;
}

/**
 * QueryMatch
 * 
 * Specialized component for granular rendering based on query state.
 * Reduces boilerplate of checking isLoading/isError in the parent component.
 * 
 * Usage:
 * <QueryMatch 
 *   signal={querySignal} 
 *   selector={res => res.status}
 * >
 *   {status => (
 *      status === 'pending' ? <Spinner /> :
 *      status === 'error' ? <Error /> :
 *      <DataView />
 *   )}
 * </QueryMatch>
 */
export function QueryMatch<T, TResult>({ signal, selector, children }: QueryMatchProps<T, TResult>) {
    return (
        <SignalValue signal={signal}>
            {(value) => {
                const selected = selector(value);
                return children(selected);
            }}
        </SignalValue>
    );
}

/**
 * Match
 * Simpler version that just matches a value.
 */
export function Match<T>({ signal, when, children }: { signal: Signal<T>; when: (value: T) => boolean; children: React.ReactNode }) {
    return (
        <SignalValue signal={signal}>
            {(value) => when(value) ? children : null}
        </SignalValue>
    );
}
