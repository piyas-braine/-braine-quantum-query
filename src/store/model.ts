
import { createSignal, type Signal, effect } from '../signals';

export interface StorageAdapter {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
}

export interface AtomOptions<T> {
    key?: string;
    storage?: 'local' | 'session' | StorageAdapter;
    validate?: (data: unknown) => T; // Schema-first validation
    debug?: boolean;
}

/**
 * createAtom (Unified Client State)
 * A Signal with built-in persistence powers.
 */
export function atom<T>(initialValue: T, options?: AtomOptions<T>): Signal<T> {
    const s = createSignal(initialValue);

    if (options?.key) {
        setupPersistence(s, options);
    }

    return s;
}

function setupPersistence<T>(s: Signal<T>, options: AtomOptions<T>) {
    const { key, storage = 'local', debug } = options;
    if (!key) return;

    let engine: StorageAdapter | null = null;

    if (typeof storage === 'string') {
        if (typeof window !== 'undefined') {
            engine = storage === 'local' ? window.localStorage : window.sessionStorage;
        }
    } else {
        engine = storage;
    }

    if (!engine) return;

    // 1. Hydrate
    try {
        const stored = engine.getItem(key);
        const applyValue = (val: string) => {
            try {
                const parsed = JSON.parse(val);
                const validated = options.validate ? options.validate(parsed) : parsed as T;
                s.set(validated);
                if (debug) console.log(`[Quantum] Hydrated atom '${key}'`);
            } catch (e) {
                if (debug) console.error(`[Quantum] Hydration validation failed for '${key}'`, e);
            }
        };

        if (stored instanceof Promise) {
            stored.then(val => {
                if (val) applyValue(val);
            });
        } else if (stored) {
            applyValue(stored);
        }
    } catch (err) {
        if (debug) console.error(`[Quantum] Hydration error`, err);
    }

    // 2. Persist
    // We subscribe to the signal using effect (via our subscribe wrapper which uses effect internally if implemented that way, 
    // but our createSignal.subscribe uses effect).
    s.subscribe((value) => {
        try {
            const serialized = JSON.stringify(value);
            engine!.setItem(key, serialized);
            if (debug) console.log(`[Quantum] Saved atom '${key}'`);
        } catch (err) {
            if (debug) console.error(`[Quantum] Save error`, err);
        }
    });
}
