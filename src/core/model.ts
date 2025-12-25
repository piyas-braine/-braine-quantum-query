import { createState } from './proxy';

type ModelDefinition<S, A, C> = {
    state: S;
    actions?: A & ThisType<S & A & C>;
    computed?: C & ThisType<S & A & C>;
};

// Helper to extract return types from computed functions
type ComputedValues<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => infer R ? R : never;
};

export function defineModel<S extends object, A extends object, C extends object>(
    def: ModelDefinition<S, A, C>
): S & A & ComputedValues<C> {
    const target = def.state as object;

    // 1. Attach Actions
    if (def.actions) {
        for (const [key, fn] of Object.entries(def.actions)) {
            // We attach directly to the target. 
            // When called via proxy.action(), 'this' will be the proxy.
            (target as Record<string, unknown>)[key] = fn;
        }
    }

    // 2. Attach Computed Properties
    if (def.computed) {
        for (const [key, getter] of Object.entries(def.computed)) {
            if (typeof getter === 'function') {
                Object.defineProperty(target, key, {
                    get: function () {
                        // 'this' is the proxy here
                        return getter.call(this);
                    },
                    enumerable: true,
                    configurable: true
                });
            }
        }
    }

    // 3. Create Reactive Proxy
    // This makes 'this.state' tracking work automatically
    return createState(target) as S & A & ComputedValues<C>;
}



