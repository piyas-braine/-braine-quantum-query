import { createState, subscribe } from './proxy';

// Standard Storage Interface (Compatible with localStorage & AsyncStorage)
export interface StorageAdapter {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
}

export type PersistOptions<S> = {
    key: string;
    storage?: 'local' | 'session' | StorageAdapter;
    paths?: (keyof S)[];
    debug?: boolean;
};

type ModelDefinition<S, A, C> = {
    state: S;
    actions?: A & ThisType<S & A & C>;
    computed?: C & ThisType<S & A & C>;
    persist?: PersistOptions<S>;
};

// Helper to extract return types from computed functions
type ComputedValues<T> = {
    [K in keyof T]: T[K] extends (...args: unknown[]) => infer R ? R : never;
};

// Simple debounce for saving state
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

export function defineModel<S extends object, A extends object, C extends object>(
    def: ModelDefinition<S, A, C>
): S & A & ComputedValues<C> {
    const target = def.state as object;

    // 1. Attach Actions
    if (def.actions) {
        for (const [key, fn] of Object.entries(def.actions)) {
            (target as Record<string, unknown>)[key] = fn;
        }
    }

    // 2. Attach Computed Properties
    if (def.computed) {
        for (const [key, getter] of Object.entries(def.computed)) {
            if (typeof getter === 'function') {
                Object.defineProperty(target, key, {
                    get: function () {
                        return getter.call(this);
                    },
                    enumerable: true,
                    configurable: true
                });
            }
        }
    }

    // 3. Create Reactive Proxy
    const proxy = createState(target) as S & A & ComputedValues<C>;

    // 4. Persistence Logic
    if (def.persist) {
        const { key, storage = 'local', paths, debug } = def.persist;

        // Resolve Storage Engine
        let engine: StorageAdapter | null = null;

        if (typeof storage === 'string') {
            if (typeof window !== 'undefined') {
                engine = storage === 'local' ? window.localStorage : window.sessionStorage;
            }
        } else {
            engine = storage; // Custom Adapter (AsyncStorage)
        }

        if (engine) {
            // A. Hydrate (Load)
            const hydrate = () => {
                const process = (stored: string | null) => {
                    try {
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            Object.assign(proxy, parsed);
                            if (debug) console.log(`[Quantum] Hydrated '${key}'`, parsed);
                        }
                    } catch (err) {
                        if (debug) console.error(`[Quantum] Hydration Failed for '${key}'`, err);
                    }
                };

                try {
                    const result = engine!.getItem(key);
                    if (result instanceof Promise) {
                        result.then(process);
                    } else {
                        process(result);
                    }
                } catch (err) {
                    if (debug) console.error(`[Quantum] Storage Access Failed`, err);
                }
            };

            // Trigger Hydration
            hydrate();

            // B. Auto-Save (Subscribe)
            // B. Auto-Save (Subscribe)
            const save = debounce(async () => {
                try {
                    let stateToSave: Partial<S>;

                    // Filter paths if needed
                    if (paths) {
                        stateToSave = {} as Partial<S>;
                        for (const p of paths) {
                            stateToSave[p] = proxy[p];
                        }
                    } else {
                        // Create clean object safely without ANY
                        stateToSave = {} as Partial<S>;
                        // We iterate the KEYS of the original state definition
                        // to ensure we only save State, not Actions or Computed
                        const keys = Object.keys(def.state as object) as Array<keyof S>;
                        for (const k of keys) {
                            stateToSave[k] = proxy[k];
                        }
                    }

                    const serialized = JSON.stringify(stateToSave);
                    await engine!.setItem(key, serialized);
                    if (debug) console.log(`[Quantum] Saved '${key}'`);
                } catch (err) {
                    // Fail silently in prod
                }
            }, 100); // Debounce

            subscribe(proxy, () => {
                save();
            });
        }
    }

    return proxy;
}
